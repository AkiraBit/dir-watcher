# Dir Watcher

A simple, efficient and flexible cross-platform directory watching library.

这个库的诞生是因为[PicSharp](https://github.com/AkiraBit/PicSharp)需要一个跨平台的目录监听库，用于监听目录中的文件变化，并进行相应的处理。最初我使用的是[chokidar](https://github.com/paulmillr/chokidar)，但在监听大文件夹时，会存在性能问题。

## Features

- Cross-platform
- Efficient
- Flexible
- Easy to use

## Install

```bash
npm install dir-watcher
```

## Example

```ts
import { watch } from "dir-watcher";

async function main() {
	const watcher = await watch({
		root: "/path/to/watch",
		interval: 1000,
	});

	watcher.on("change", (path) => {
		console.log("change", path);
	});
}

main();
```

## Event

| Event    | Type                               | Description                             |
| -------- | ---------------------------------- | --------------------------------------- |
| `CHANGE` | ()=>void                           | The directory or file has been changed. |
| `RENAME` | (from: string, to: string) => void | The directory or file has been renamed. |
| `MOVE`   | (from: string, to: string) => void | The directory or file has been moved.   |
| `DELETE` | (path: string) => void             | The directory or file has been deleted. |
| `CREATE` | (path: string) => void             | The directory or file has been created. |
| `ERROR`  | (error: Error) => void             | An error occurred.                      |

## License

MIT
