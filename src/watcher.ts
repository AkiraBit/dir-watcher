import readdirp, { ReaddirpOptions, EntryInfo } from "readdirp";
import { EventEmitter } from "node:events";
import { parse, join } from "node:path";
import { DirTree, DirTreeNode } from "./DirTree";
import {
	Event,
	NodeType,
	DirTreeNodeData,
	DirWatcherEventMap,
	EventPayload,
	IgnoredOption,
} from "./types";
import {
	watchFile,
	watch,
	FSWatcher,
	StatWatcher,
	unwatchFile,
	WatchEventType,
	Stats,
} from "node:fs";
import { exists, hashFile } from "./utils";
import debounce from "lodash.debounce";
import { stat } from "node:fs/promises";
import micromatch from "micromatch";

export interface WatcherOptions {
	ignore?: IgnoredOption;
	directoryFilter?: ReaddirpOptions["directoryFilter"];
	fileFilter?: ReaddirpOptions["fileFilter"];
	depth?: ReaddirpOptions["depth"];
}
export class Watcher extends EventEmitter<DirWatcherEventMap> {
	public ready: boolean = false;
	public closed: boolean = false;
	private _path: string;
	private _options: WatcherOptions;
	public _dirTree: DirTree<DirTreeNodeData>;
	private _selfWatcher: StatWatcher | null = null;
	private _watcher: FSWatcher | null = null;
	private _isProcessing: boolean = false;
	private _isInitializing: boolean = true;
	private _eventQueue: Map<string, Set<string>> = new Map();

	constructor(path: string, options: WatcherOptions = {}) {
		super();
		this._path = path;
		this._options = options;
		this._init();
	}

	private _isIgnored = (path: string): boolean => {
		if (!this._options.ignore) {
			return false;
		}

		// Function-based ignore
		if (typeof this._options.ignore === "function") {
			return this._options.ignore(path);
		}

		// Glob-based ignore
		return micromatch.isMatch(path, this._options.ignore);
	};

	private _init = async () => {
		this._guardSelf();
		this._watch();
		this._dirTree = await this._buildDirTree(this._path, {
			fileFilter: this._options?.fileFilter,
			directoryFilter: this._options?.directoryFilter,
			depth: this._options?.depth,
			type: "files_directories",
			alwaysStat: true,
		});
		this._isInitializing = false;
		this._eventsHandler();
		this.ready = true;
		this.emit(Event.READY);
	};

	private _guardSelf = () => {
		this._selfWatcher = watchFile(
			this._path,
			{ persistent: true, interval: 1000 },
			(curr) => {
				if (
					Object.values(curr).every((value) => {
						if (typeof value === "number") {
							return value === 0;
						} else if (value instanceof Date) {
							return value.getTime() === 0;
						}
						return false;
					})
				) {
					this.emit(Event.SELF_ENOENT);
					this.close();
				}
			}
		);
	};

	private _buildDirTree = async (
		path: string,
		options?: Partial<ReaddirpOptions>
	) => {
		async function initFileNode(
			node: DirTreeNode<DirTreeNodeData>,
			path: string,
			stats: Stats
		) {
			const hash = await hashFile(path);
			node.key = hash + stats.ino.toString() + stats.dev.toString();
			node.content_hash = hash;
		}
		return new Promise<DirTree<DirTreeNodeData>>(async (resolve, reject) => {
			if (!(await exists(path))) {
				reject(new Error(`[DirWatcher] path ${path} not exists`));
				return;
			}
			const info = await stat(path);
			const { name } = parse(path);
			const tree = new DirTree<DirTreeNodeData>(
				path,
				name,
				info.ino.toString() + info.dev.toString()
			);
			const queue: Array<Promise<void>> = [];
			readdirp(path, options)
				.on("data", (entry: EntryInfo) => {
					const { fullPath, stats } = entry;
					if (stats?.isDirectory()) {
						tree.add(
							fullPath,
							NodeType.DIRECTORY,
							stats.ino.toString() + stats.dev.toString()
						);
					} else {
						const { dir, name, ext, base } = parse(fullPath);
						const node = tree.add(fullPath, NodeType.FILE, "", "", {
							fullPath,
							dir,
							name: base,
							basename: name,
							ext,
							stats: entry.stats,
						});
						queue.push(initFileNode(node, fullPath, entry.stats));
					}
				})
				.on("warn", (error) => {
					console.warn("[DirWatcher] warning:", error);
				})
				.on("error", (error) => {
					reject(error);
				})
				.on("end", async () => {
					await Promise.all(queue);
					resolve(tree);
				});
		});
	};

	private _eventsHandler = async () => {
		if (
			this._isProcessing ||
			this._eventQueue.size === 0 ||
			this._isInitializing
		)
			return;

		this._isProcessing = true;

		while (this._eventQueue.size > 0) {
			const eventsToProcess = Array.from(this._eventQueue.entries());
			this._eventQueue.clear();

			const emitterQueue = new Map<Event, Map<string, EventPayload>>([
				[Event.ADD, new Map()],
				[Event.REMOVE, new Map()],
			]);

			await Promise.all(
				eventsToProcess.map(async ([dir, paths]) =>
					this._diff(dir, paths, emitterQueue)
				)
			);

			for (const [event, queue] of emitterQueue.entries()) {
				if (event === Event.ADD) {
					for (const [key, payload] of queue.entries()) {
						if (emitterQueue.get(Event.REMOVE)?.has(key)) {
							const removePayload = emitterQueue.get(Event.REMOVE)?.get(key);
							if (
								payload &&
								removePayload &&
								payload.name !== removePayload.name
							) {
								this.emit(Event.RENAME, removePayload, payload);
							} else {
								this.emit(Event.MOVE, removePayload, payload);
							}
						} else {
							this.emit(event, payload);
						}
					}
				} else if (event === Event.REMOVE) {
					for (const [key, payload] of queue.entries()) {
						if (!emitterQueue.get(Event.ADD)?.has(key)) {
							this.emit(event, payload);
						}
					}
				}
			}
		}

		this._isProcessing = false;
	};

	private _diff = async (
		dir: string,
		paths: Set<string>,
		emitterQueue: Map<Event, Map<string, EventPayload>>
	) => {
		try {
			const newTree = await this._buildDirTree(dir, {
				depth: 1,
				type: "files_directories",
				alwaysStat: true,
				fileFilter: this._options?.fileFilter,
				directoryFilter: this._options?.directoryFilter,
			});
			for (const path of paths) {
				const newNode = newTree.getNode(path);
				const oldNode = this._dirTree.getNode(path);
				// Check if it's a new addition
				if (newNode && !oldNode) {
					if (newNode?.isDirectory) {
						const newNodeTree = await this._buildDirTree(newNode?.fullPath, {
							type: "files_directories",
							alwaysStat: true,
							fileFilter: this._options?.fileFilter,
							directoryFilter: this._options?.directoryFilter,
						});
						const newDirNode = this._dirTree.add(
							newNodeTree.root.fullPath,
							newNodeTree.root.node_type,
							newNodeTree.root.key
						);
						newDirNode.children = newNodeTree.root.children;
						emitterQueue.get(Event.ADD)?.set(newNode?.key, {
							fullPath: newNode?.fullPath,
							isDirectory: newNode?.isDirectory,
							isFile: newNode?.isFile,
							key: newNode?.key,
							name: newNode?.name,
						});
					} else {
						this._dirTree.add(
							path,
							newNode.node_type,
							newNode.key,
							newNode?.content_hash,
							newNode?.data
						);
						emitterQueue.get(Event.ADD)?.set(newNode?.key, {
							fullPath: newNode?.fullPath,
							isDirectory: newNode?.isDirectory,
							isFile: newNode?.isFile,
							key: newNode?.key,
							name: newNode?.name,
							basename: newNode?.data?.basename,
							ext: newNode?.data?.ext,
							content_hash: newNode?.content_hash,
						});
					}
				}
				// Check if it's a deletion
				else if (!newNode && oldNode) {
					if (!(await exists(oldNode?.fullPath))) {
						if (oldNode?.isDirectory) {
							emitterQueue.get(Event.REMOVE)?.set(oldNode?.key, {
								fullPath: oldNode?.fullPath,
								isDirectory: oldNode?.isDirectory,
								isFile: oldNode?.isFile,
								key: oldNode?.key,
								name: oldNode?.name,
							});
						} else {
							emitterQueue.get(Event.REMOVE)?.set(oldNode?.key, {
								fullPath: oldNode?.fullPath,
								isDirectory: oldNode?.isDirectory,
								isFile: oldNode?.isFile,
								key: oldNode?.key,
								name: oldNode?.name,
								basename: oldNode?.data?.basename,
								ext: oldNode?.data?.ext,
								content_hash: oldNode?.content_hash,
							});
						}
						this._dirTree.delete(oldNode?.fullPath);
					}
				} else if (newNode && oldNode && newNode.key !== oldNode.key) {
					// 目录替换场景下，需要判断目录的key(ino + dev)是否发生变化
					if (newNode.isDirectory && newNode.key !== oldNode.key) {
						this.emit(
							Event.CHANGE,
							{
								fullPath: newNode?.fullPath,
								isDirectory: newNode?.isDirectory,
								isFile: newNode?.isFile,
								key: newNode?.key,
								name: newNode?.name,
							},
							{
								fullPath: oldNode?.fullPath,
								isDirectory: oldNode?.isDirectory,
								isFile: oldNode?.isFile,
								key: oldNode?.key,
								name: oldNode?.name,
							}
						);
					}
					// 文件替换场景下，还需要判断文件内容哈希是否发生变化判断文件内容是否发生变更
					else if (newNode.content_hash !== oldNode.content_hash) {
						this.emit(
							Event.CHANGE,
							{
								fullPath: oldNode?.fullPath,
								isDirectory: oldNode?.isDirectory,
								isFile: oldNode?.isFile,
								key: oldNode?.key,
								name: oldNode?.name,
								basename: oldNode?.data?.basename,
								ext: oldNode?.data?.ext,
								content_hash: oldNode?.content_hash,
							},
							{
								fullPath: newNode?.fullPath,
								isDirectory: newNode?.isDirectory,
								isFile: newNode?.isFile,
								key: newNode?.key,
								name: newNode?.name,
								basename: newNode?.data?.basename,
								ext: newNode?.data?.ext,
								content_hash: newNode?.content_hash,
							}
						);
					}
					this._dirTree.update(newNode?.fullPath, newNode);
				}
			}
		} catch (error) {
			this._errorHandler(error);
		}
	};

	private _debouncedHandler = debounce(this._eventsHandler, 100);

	private _watch = () => {
		try {
			this._watcher = watch(
				this._path,
				{ recursive: true },
				(event: WatchEventType, filename: string | Buffer | null) => {
					if (filename) {
						const fullPath = join(this._path, filename.toString());

						if (this._isIgnored(fullPath)) {
							return;
						}

						const { dir } = parse(fullPath);
						if (!this._eventQueue.has(dir)) {
							this._eventQueue.set(dir, new Set());
						}
						this._eventQueue.get(dir)?.add(fullPath);
						this._debouncedHandler();
					}
				}
			);
		} catch (error: unknown) {
			this._errorHandler(error);
		}
	};

	private _errorHandler = (error: unknown) => {
		this.emit(
			Event.ERROR,
			error instanceof Error ? error : new Error(String(error))
		);
	};

	public close = () => {
		if (this.closed) return;
		this.closed = true;
		this._isProcessing = false;
		this._eventQueue.clear();
		this._dirTree.destroy();
		this._dirTree = null;
		this._selfWatcher?.unref();
		this._watcher?.close();
		this._watcher?.unref();
		unwatchFile(this._path);
		this._watcher?.removeAllListeners();
		this._selfWatcher = null;
		this._watcher = null;
		this.emit(Event.CLOSE);
		this.removeAllListeners();
	};
}
