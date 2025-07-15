# 📁 🕵️ dirspy

A simple, efficient, cross-platform directory monitoring library.

This library was created because the "monitor new images in a directory and process them automatically" feature of [PicSharp](https://github.com/AkiraBit/PicSharp) required a cross-platform directory watching library. Initially, I used Rust's [notify](https://crates.io/crates/notify) and Node.js's [chokidar](https://github.com/paulmillr/chokidar), which are among the most popular file watching libraries in their respective ecosystems. However, I found that they both have issues when watching large directories (10,000+ files and deep subdirectories):

- notify: When watching a large number of files, it has performance and reliability issues, leading to high CPU usage, reduced or no event triggering, and incorrect event trigger order. See: [notify doc: Watching large directories](https://docs.rs/notify/8.1.0/notify/#watching-large-directories).
- chokidar: When watching a large number of files in non-polling mode, it can exhaust all operating system file handles during initialization, causing EMFILE and ENOSPC errors. Polling mode can avoid the file handle exhaustion problem, but it causes high CPU usage, often maxing it out, when watching many files. See: [chokidar doc: Troubleshooting](https://github.com/paulmillr/chokidar?tab=readme-ov-file#troubleshooting).
- In addition to the above issues, the types of file change events they can listen for are limited, for example, they cannot listen for file renames or moves.

Both notify and chokidar are battle-tested and suitable for most scenarios, but they couldn't meet my needs for watching large directories. Therefore, I decided to implement a simple, efficient directory monitoring library focused on folder watching and providing richer change event types.

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

| Event         | Listener                                             | Description                                                      |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `READY`       | ()=>void                                             | Initialization is complete and watching can begin.               |
| `WALK_WARN`   | (err: Error)=>void                                   | A non-fatal error was captured while walking the directory tree. |
| `SELF_ENOENT` | ()=>void                                             | The watched directory has been changed, e.g., deleted or moved.  |
| `CLOSE`       | ()=>void                                             | The watcher has been closed.                                     |
| `RAW`         | (event: WatchEventType, path: string)=>void          | Raw event from fs.watch.                                         |
| `ERROR`       | (err: Error)=>void                                   | An error was captured during watching.                           |
| `ADD`         | (data: EventPayload)=>void                           | A file or directory has been added.                              |
| `REMOVE`      | (data: EventPayload)=>void                           | A file or directory has been removed.                            |
| `CHANGE`      | (oldData: EventPayload, newData: EventPayload)=>void | A file or directory has been changed.                            |
| `RENAME`      | (oldData: EventPayload, newData: EventPayload)=>void | A file or directory has been renamed.                            |
| `MOVE`        | (from: EventPayload, to: EventPayload)=>void         | A file or directory has been moved.                              |

## API

### `watch(path: string, options?: WatchOptions)`

Initializes the watcher and returns a `Watcher` instance.

### `watcher.close()`

Closes the watcher.

### `WatchOptions`

Watch options.

- `fileFilter(entry: EntryInfo): boolean`: A file filter to ignore unwanted files during the initial directory tree snapshot creation.
- `directoryFilter(entry: EntryInfo): boolean`: A directory filter to ignore unwanted directories during the initial directory tree snapshot creation.
- `depth:number`: The depth to watch directories, defaults to no limit.
- `ignored(path: string): boolean`: Paths to files or directories to be ignored when processing `fs.watch` events internally.

### `Watcher.closed`

Whether the watcher is closed.

### `methods of EventEmitter`

`Watcher` inherits from `node:events.EventEmitter`.

## How it works

TODO

## License

MIT
