import type { WatchEventType, Stats } from "node:fs";

export enum NodeType {
	FILE = "file",
	DIRECTORY = "directory",
}

export interface DirTreeNodeData {
	dir: string;
	name: string;
	basename: string;
	ext: string;
	fullPath: string;
	stats: Stats;
}

export interface DirTreeStats {
	// file count
	fileCount: number;
	// directory count
	directoryCount: number;
	// max depth
	maxDepth: number;
}

/**
 * Event types
 */
export enum Event {
	/**
	 * Initialization is complete and listening can begin.
	 */
	READY = "READY",
	/**
	 * Non-fatal error captured by the listener.
	 */
	WALK_WARN = "WALK_WARN",
	/**
	 * SELF_ENOENT error captured by the self-listener, indicating that the watched directory does not exist.
	 */
	SELF_ENOENT = "SELF_ENOENT",
	/**
	 * Raw event from fs.watch.
	 */
	RAW = "RAW",
	/**
	 * Error captured by the listener.
	 */
	ERROR = "ERROR",
	/**
	 * Listener is closed.
	 */
	CLOSE = "CLOSE",
	/**
	 * A file has been added.
	 */
	ADD = "ADD",
	/**
	 * A file has been removed.
	 */
	REMOVE = "REMOVE",
	/**
	 * A file has been changed.
	 */
	CHANGE = "CHANGE",
	/**
	 * A file has been renamed.
	 */
	RENAME = "RENAME",
	/**
	 * A file has been moved.
	 */
	MOVE = "MOVE",
}

export type EventPayload = {
	fullPath: string;
	isDirectory: boolean;
	isFile: boolean;
	key: string;
	name: string;
	basename?: string;
	ext?: string;
	content_hash?: string;
};

export interface DirWatcherEventMap {
	[Event.READY]: [];
	[Event.WALK_WARN]: [Error];
	[Event.SELF_ENOENT]: [];
	[Event.CLOSE]: [];
	[Event.RAW]: [WatchEventType, string];
	[Event.ERROR]: [Error];
	[Event.ADD]: [EventPayload];
	[Event.REMOVE]: [EventPayload];
	[Event.CHANGE]: [EventPayload, EventPayload];
	[Event.RENAME]: [EventPayload, EventPayload];
	[Event.MOVE]: [EventPayload, EventPayload];
}
