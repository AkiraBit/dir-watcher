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
 * 事件类型
 */
export enum Event {
	/**
	 * 初始化完成，可以开始监听
	 */
	READY = "READY",
	/**
	 * 监听器捕获的非致命错误
	 */
	WALK_WARN = "WALK_WARN",
	/**
	 * 自监听器捕获的自身ENOENT错误，表示监听的目录不存在
	 */
	SELF_ENOENT = "SELF_ENOENT",
	/**
	 * 来自fs.watch的原始事件
	 */
	RAW = "RAW",
	/**
	 * 监听器捕获的错误
	 */
	ERROR = "ERROR",
	/**
	 * 监听器关闭
	 */
	CLOSE = "CLOSE",
	/**
	 * 添加文件
	 */
	ADD = "ADD",
	/**
	 * 删除文件
	 */
	REMOVE = "REMOVE",
	/**
	 * 修改文件
	 */
	CHANGE = "CHANGE",
	/**
	 * 修改文件名
	 */
	RENAME = "RENAME",
	/**
	 * 移动文件
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
