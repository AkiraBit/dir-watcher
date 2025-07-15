# 📁 🕵️ dirspy

精简、高效的跨平台目录监控库。

这个库的诞生是因为[PicSharp](https://github.com/AkiraBit/PicSharp)的“监听目录中新增图片并自动处理”功能需要一个跨平台的目录监听库。最初我分别使用的是 Rust 的 [notify](https://crates.io/crates/notify) 和 Node.js 的[chokidar](https://github.com/paulmillr/chokidar)，它们分别是各自生态中最受欢迎的文件监听库之一，但实际使用时我发现它们在监听大文件夹（10000+ 个以上文件以及深层次的子目录）时，都存在一定问题：

- notify: 监听大量文件时，存在性能和可靠性问题，导致 CPU 占用率过高、监听事件的触发频率降低或不触发、监听事件的触发顺序不正确等问题，参考： [notify doc: Watching large directories](https://docs.rs/notify/8.1.0/notify/#watching-large-directories)。
- chokidar: 非轮询模式下监听大量文件时，会在初始化时耗尽操作系统所有文件句柄导致 EMFILE 和 ENOSP 错误；轮询模式可以避免文件句柄耗尽的问题，但监听大量文件时会造成 CPU 使用率过高，通常是占满，参考： [chokidar doc: Troubleshooting](https://github.com/paulmillr/chokidar?tab=readme-ov-file#troubleshooting)。
- 除了上述问题外，它们所能监听的文件变化类型事件也有限，例如无法监听文件重命名、移动等。

notify 和 chokidar 都久经生成环境考验，适用于大部分场景，但在监听大文件夹时无法满足我的需求，因此，我决定实现一个简单高效、专注于文件夹监控、提供更丰富的变化类型事件监听的目录监控库。

## Install

```bash
npm install dirspy
```

## Get Started

```ts
import { parse, join } from "node:path";
import { watch, Event } from "dirspy";

export const VALID_IMAGE_EXTS = [
	".png",
	".jpg",
	".jpeg",
	".webp",
	".avif",
	".svg",
	".gif",
	".tiff",
	".tif",
];

const ignores = [
	".pnpm",
	".git",
	".DS_Store",
	".idea",
	".vscode",
	".gitignore",
	".gitignore",
	"node_modules",
	"target",
	"maven",
	"gradle",
	"build",
	"out",
	"bin",
	"obj",
	"lib",
];

async function main() {
	const watcher = await watch("/foo", {
		fileFilter: (entry) => {
			if (ignores.some((ignore) => entry.fullPath.includes(ignore)))
				return false;
			return VALID_IMAGE_EXTS.includes(parse(entry.path).ext);
		},
		directoryFilter: (entry) => {
			return !ignores.includes(entry.basename);
		},
	});

	watcher
		.on(Event.READY, () => {
			console.log("ready");
		})
		.on(Event.SELF_ENOENT, () => {
			console.log("self-enoent");
		})
		.on(Event.ADD, (data) => {
			console.log("add", data.fullPath);
		})
		.on(Event.REMOVE, (data) => {
			console.log("remove", data.fullPath);
		})
		.on(Event.RENAME, (oldData, newData) => {
			console.log("rename", oldData.name, newData.name);
		})
		.on(Event.MOVE, (from, to) => {
			console.log("move", from.fullPath, to.fullPath);
		})
		.on(Event.CHANGE, (oldData, newData) => {
			console.log("change", oldData.key, newData.key);
		});

	// close the watcher
	// watcher.close();
}

main();
```

## Event

| Event         | Listener                                             | Description                                                                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `READY`       | ()=>void                                             | Initialization is complete and listening can begin.                                               |
| `WALK_WARN`   | (err: Error)=>void                                   | Non-fatal error captured while walking the directory tree.                                        |
| `SELF_ENOENT` | ()=>void                                             | The watched directory has been changed, such as being deleted or having its location altered, etc |
| `CLOSE`       | ()=>void                                             | The watcher is closed.                                                                            |
| `RAW`         | (event: WatchEventType, path: string)=>void          | Raw event from fs.watch.                                                                          |
| `ERROR`       | (err: Error)=>void                                   | Error captured during watching.                                                                   |
| `ADD`         | (data: EventPayload)=>void                           | A file or directory has been added.                                                               |
| `REMOVE`      | (data: EventPayload)=>void                           | A file or directory has been removed.                                                             |
| `CHANGE`      | (data: EventPayload)=>void                           | A file or directory has been changed.                                                             |
| `RENAME`      | (oldData: EventPayload, newData: EventPayload)=>void | A file or directory has been renamed.                                                             |
| `MOVE`        | (from: EventPayload, to: EventPayload)=>void         | A file or directory has been moved.                                                               |

## API

### `watch(path: string, options?: WatchOptions)`

初始化监听器，返回一个 `Watcher` 实例。

### `watch.close()`

关闭监听器。

### `WatchOptions`

监听选项。

- `fileFilter(entry: EntryInfo): boolean`: 文件过滤器，用于初始化构建目录树快照时忽略不需要的文件。
- `directoryFilter(entry: EntryInfo): boolean`: 目录过滤器，用于初始化构建目录树快照时忽略不需要的目录。
- `depth:number`: 目录的监听深度，默认为不限制。
- `ignored(path: string): boolean`: 内部处理`fs.watch` 事件时要忽略的文件或目录路径。

### `Watcher.closed`

监听器是否已关闭。

### `methods of EventEmitter`

`Watcher` 继承自 `node:events.EventEmitter`

## How it works

TODO

## License

MIT
