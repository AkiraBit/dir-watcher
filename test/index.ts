import { watch, Event, NodeType } from "../src";
import { parse } from "node:path";

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
	".md",
];

async function main() {
	console.time("ready");
	const watcher = await watch("/Users/jaylenl/Documents/", {
		ignore: (path) => {
			const { ext } = parse(path);
			return (
				ignores.some((ignore) => path.includes(ignore)) ||
				!VALID_IMAGE_EXTS.includes(ext)
			);
		},
		fileFilter: (entry) => {
			if (ignores.some((ignore) => entry.fullPath.includes(ignore)))
				return false;
			return VALID_IMAGE_EXTS.includes(parse(entry.path).ext);
		},
		directoryFilter: (entry) => {
			return !ignores.includes(entry.basename);
		},
	});
	watcher.on(Event.READY, () => {
		console.timeEnd("ready");
		// const dirTree = watcher._dirTree;
		// console.log("path", dirTree.getPaths(NodeType.FILE));
		// const node = dirTree.getNode("/Users/jaylenl/Documents/项目/kmenu/src/hooks");
		// console.log("node", node);
		// console.log("path", dirTree.getPaths(NodeType.FILE));
		// console.log("path", dirTree.getPaths(NodeType.DIRECTORY));
		// console.log("path", dirTree.stats());
	});

	watcher.on(Event.CLOSE, () => {
		console.log("close");
	});

	watcher.on(Event.ADD, (payload) => {
		console.log("add", payload.fullPath);
	});

	watcher.on(Event.REMOVE, (payload) => {
		console.log("remove", payload.fullPath);
	});

	watcher.on(Event.RENAME, (oldPayload, payload) => {
		console.log("rename", oldPayload.fullPath, payload.fullPath);
	});

	watcher.on(Event.CHANGE, (payload, oldPayload) => {
		console.log("change", payload.name, payload.key, oldPayload.key);
	});

	watcher.on(Event.MOVE, (from, to) => {
		console.log("move", from.fullPath, to.fullPath);
	});

	watcher.on(Event.RAW, (eventType, fullPath) => {
		// console.log("raw", eventType, fullPath);
	});

	watcher.on(Event.SELF_ENOENT, () => {
		console.log("self enoent");
	});
}

main();
