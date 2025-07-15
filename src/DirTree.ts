import { NodeType, DirTreeStats } from "./types";
import { normalizePath } from "./utils";
import { sep } from "node:path";

export class DirTreeNode<T> {
	// Node name. For file nodes, it's the filename with extension. For directory nodes, it's the directory name.
	name: string;
	// Unique identifier for the node. For directory nodes: stats.ino + stats.dev. For file nodes: content hash.
	key: string;
	// Absolute path of the node.
	fullPath: string;
	// Node type.
	node_type: NodeType;
	// Parent node of this node.
	parent?: DirTreeNode<T> | null;
	// Child nodes for a directory node.
	children?: Map<string, DirTreeNode<T>> | null;
	// Content hash for a file node.
	content_hash?: string | null;
	// Data for a file node.
	data?: T;

	constructor(payload: {
		name: string;
		fullPath: string;
		node_type: NodeType;
		key?: string;
		parent?: DirTreeNode<T>;
		children?: Map<string, DirTreeNode<T>>;
		content_hash?: string;
		data?: T;
	}) {
		this.name = payload.name;
		this.key = payload.key;
		this.fullPath = payload.fullPath;
		this.node_type = payload.node_type;
		this.parent = payload.parent;
		this.children = payload.children;
		this.content_hash = payload.content_hash;
	}

	get isFile() {
		return this.node_type === NodeType.FILE;
	}

	get isDirectory() {
		return this.node_type === NodeType.DIRECTORY;
	}
}

export class DirTree<T> {
	public root: DirTreeNode<T>;
	private _nodeMap: Map<string, DirTreeNode<T>> = new Map();

	constructor(rootPath: string, rootName: string, rootKey: string) {
		const node = new DirTreeNode<T>({
			name: rootName,
			key: rootKey,
			fullPath: normalizePath(rootPath),
			node_type: NodeType.DIRECTORY,
			parent: null,
			children: new Map(),
		});
		this.root = node;
		this._nodeMap.set(node.fullPath, node);
	}

	/**
	 * @description Create a node
	 * @param path - The path of the node
	 * @param node_type - The type of the node
	 * @param key - The key of the node
	 * @param content_hash - The content hash of the node
	 * @param data - The data of the node
	 * @returns The created node
	 */
	private _createNode = (
		path: string,
		node_type: NodeType,
		key?: string,
		content_hash?: string,
		data?: T
	) => {
		/**
		 * windows: ['C:', 'Users', 'username', 'Documents', 'file.txt']
		 * linux/macos: ['home', 'username', 'Documents', 'file.txt']
		 */
		const segments = path
			.replace(this.root.fullPath, "")
			.split(sep)
			.filter(Boolean);
		let current = this.root;

		for (let i = 0; i < segments.length; i++) {
			const isLastSegment = i === segments.length - 1;
			let isDirectory = node_type === NodeType.DIRECTORY || !isLastSegment;

			if (current.children) {
				const fullPath = [this.root.fullPath, ...segments.slice(0, i + 1)].join(
					sep
				);
				if (!current.children.has(fullPath)) {
					const newNode = new DirTreeNode({
						name: segments[i],
						fullPath,
						parent: current,
						node_type,
						key,
					});
					if (isDirectory) {
						newNode.children = new Map();
					} else {
						newNode.data = data;
						newNode.content_hash = content_hash;
					}
					current.children.set(fullPath, newNode);
				}
				current = current.children.get(fullPath);
			} else {
				break;
			}
		}

		return current;
	};

	/**
	 * @description Add a node to the tree
	 * @param path - The path of the node
	 * @param node_type - The type of the node
	 * @param key - The key of the node
	 * @param content_hash - The content hash of the node
	 * @param data - The data of the node
	 * @returns The created node
	 */
	public add = (
		path: string,
		node_type: NodeType,
		key?: string,
		content_hash?: string,
		data?: T
	): DirTreeNode<T> | undefined => {
		path = normalizePath(path);
		if (!path.startsWith(this.root.fullPath) || this._nodeMap.has(path)) {
			return;
		}
		const node = this._createNode(path, node_type, key, content_hash, data);
		this._nodeMap.set(path, node);
		return node;
	};

	/**
	 * @description Delete a node from the tree
	 * @param path - The path of the node
	 * @returns The deleted node
	 */
	public delete = (path: string): DirTreeNode<T> | undefined => {
		path = normalizePath(path);
		if (!this._nodeMap.has(path)) {
			return;
		}
		const node = this._nodeMap.get(path);
		if (node.parent) {
			node.parent.children.delete(node.fullPath);
		}
		if (node.isDirectory) {
			for (const p of this._nodeMap.keys()) {
				if (p.startsWith(path)) {
					this._nodeMap.delete(p);
				}
			}
		}
		this._nodeMap.delete(path);
		return node;
	};

	/**
	 * @description Update a node in the tree
	 * @param path - The path of the node
	 * @param payload - The payload of the node
	 */
	public update = (
		path: string,
		payload: { key?: string; content_hash?: string; data?: T }
	) => {
		path = normalizePath(path);
		if (!this._nodeMap.has(path)) {
			return;
		}
		const node = this._nodeMap.get(path);
		if (payload.key) {
			node.key = payload.key;
		}
		if (payload.data) {
			node.data = payload.data;
		}
		if (payload.content_hash) {
			node.content_hash = payload.content_hash;
		}
		return node;
	};

	/**
	 * @description Check if a node exists in the tree
	 * @param path - The path of the node
	 * @param type - The type of the node
	 * @returns True if the node exists, false otherwise
	 */
	public has = (
		path: string,
		type: "all" | NodeType.FILE | NodeType.DIRECTORY = "all"
	): boolean => {
		path = normalizePath(path);
		if (!this._nodeMap.has(path)) {
			return;
		}
		const node = this._nodeMap.get(path);
		if (type === "all") {
			return true;
		} else if (type === NodeType.FILE) {
			return node.isFile;
		} else {
			return node.isDirectory;
		}
	};

	/**
	 * @description Get a node from the tree
	 * @param path - The path of the node
	 * @returns The node
	 */
	public getNode = (path: string): DirTreeNode<T> | undefined => {
		path = normalizePath(path);
		return this._nodeMap.get(path);
	};

	/**
	 * @description Get all file node paths
	 * @returns All file node paths
	 */
	public getPaths(type: "all" | NodeType.FILE | NodeType.DIRECTORY): string[] {
		const paths: string[] = [];

		if (!this.root.children) {
			return paths;
		}

		const queue: DirTreeNode<T>[] = [];
		for (const node of this.root.children.values()) {
			queue.push(node);
		}

		while (queue.length > 0) {
			const node = queue.shift()!;
			if (
				type === "all" ||
				(type === NodeType.FILE && node.isFile) ||
				(type === NodeType.DIRECTORY && node.isDirectory)
			) {
				paths.push(node.fullPath);
			}

			if (node.children) {
				for (const childNode of node.children.values()) {
					queue.push(childNode);
				}
			}
		}

		return paths;
	}

	/**
	 * @description Get the stats of the tree
	 * @returns The stats of the tree
	 */
	public stats(): DirTreeStats {
		let directoryCount = 0;
		let fileCount = 0;
		let maxDepth = 0;

		if (!this.root.children) {
			return {
				fileCount,
				directoryCount,
				maxDepth,
			};
		}

		const queue: [DirTreeNode<T>, number][] = [];

		for (const node of this.root.children.values()) {
			queue.push([node, 0]);
		}

		while (queue.length > 0) {
			const [node, depth] = queue.shift()!;

			maxDepth = Math.max(maxDepth, depth);

			if (node.isFile) {
				fileCount++;
			} else {
				directoryCount++;
				if (node.children) {
					for (const childNode of node.children.values()) {
						queue.push([childNode, depth + 1]);
					}
				}
			}
		}

		return {
			fileCount,
			directoryCount,
			maxDepth,
		};
	}

	public destroy() {
		this._nodeMap.clear();
		this.root.children?.clear();
		this.root = null;
	}
}
