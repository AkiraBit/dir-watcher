import { parse, sep } from "node:path";
import { access, constants } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function isMacOs() {
	return process.platform === "darwin";
}

export function isWindows() {
	return process.platform === "win32";
}

export function isLinux() {
	return process.platform === "linux";
}

export function splitPath(path: string): string[] {
	const { dir, base } = parse(path.trim());
	const segments = dir.split(sep).filter(Boolean);
	segments.push(base);
	return segments;
}

export async function hasPermission(
	filePath: string,
	mode: number = constants.F_OK
): Promise<boolean> {
	try {
		await access(filePath, mode);
		return true;
	} catch {
		return false;
	}
}

export async function isReadable(filePath: string): Promise<boolean> {
	return hasPermission(filePath, constants.R_OK);
}

export async function isWritable(filePath: string): Promise<boolean> {
	return hasPermission(filePath, constants.W_OK);
}

export async function isExecutable(filePath: string): Promise<boolean> {
	return hasPermission(filePath, constants.X_OK);
}

export async function exists(filePath: string): Promise<boolean> {
	return hasPermission(filePath);
}

export function getFileName(filePath: string): string {
	const { name, ext } = parse(filePath);
	return `${name}${ext}`;
}

export function hashFile(
	filePath: string,
	algorithm = "md5",
	highWaterMark = 1024 * 1024
) {
	return new Promise<string>((resolve, reject) => {
		const hash = createHash(algorithm);
		const stream = createReadStream(filePath, { highWaterMark });
		stream.on("error", reject);
		hash.on("error", reject);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}

export function normalizePath(filePath: string): string {
	// 如果路径为空或只有分隔符，直接返回
	if (!filePath || filePath === sep) {
		return filePath;
	}

	// 移除路径末尾的分隔符
	// 兼容 Windows 的反斜杠和 Unix 的正斜杠
	return filePath.replace(/[/\\]+$/, "");
}
