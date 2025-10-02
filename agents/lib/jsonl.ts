import { join } from "node:path";
import { stat } from "node:fs/promises";
import { Glob } from "bun";

export interface JsonlFile {
    path: string;
    mtime: Date;
}

export async function findJsonlFiles(directory: string): Promise<JsonlFile[]> {
    const glob = new Glob("*.jsonl");
    const jsonlFiles: JsonlFile[] = [];

    for await (const filename of glob.scan(directory)) {
        const fullPath = join(directory, filename);
        const stats = await stat(fullPath);
        jsonlFiles.push({ path: fullPath, mtime: stats.mtime });
    }

    // Sort by most recently updated first
    jsonlFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return jsonlFiles;
}

export async function readJsonlFile<T = any>(filePath: string): Promise<T[]> {
    const file = Bun.file(filePath);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    const parsedLines = lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (error) {
            console.error("Error parsing JSON line:", error);
            console.error("Line content:", line);
            return null;
        }
    }).filter(Boolean) as T[];

    return parsedLines;
}

export async function readMostRecentJsonl<T = any>(directory: string): Promise<{ data: T[]; file: JsonlFile } | null> {
    const jsonlFiles = await findJsonlFiles(directory);
    
    if (jsonlFiles.length === 0) {
        return null;
    }

    const mostRecentFile = jsonlFiles[0];
    if (!mostRecentFile) {
        return null;
    }

    console.log("Reading JSONL file:", mostRecentFile.path);
    const data = await readJsonlFile<T>(mostRecentFile.path);
    
    return { data, file: mostRecentFile };
}

export async function readMostRecentJsonlAsText(directory: string): Promise<{ text: string; file: JsonlFile } | null> {
    const jsonlFiles = await findJsonlFiles(directory);
    
    if (jsonlFiles.length === 0) {
        return null;
    }

    const mostRecentFile = jsonlFiles[0];
    if (!mostRecentFile) {
        return null;
    }

    console.log("Reading JSONL file as text:", mostRecentFile.path);
    const file = Bun.file(mostRecentFile.path);
    const text = await file.text();
    
    return { text, file: mostRecentFile };
}

export async function readAllJsonlsAsText(directory: string): Promise<{ text: string; files: JsonlFile[] } | null> {
    const jsonlFiles = await findJsonlFiles(directory);
    
    if (jsonlFiles.length === 0) {
        return null;
    }

    console.log(`Reading ${jsonlFiles.length} JSONL files as text`);
    
    // Read all files and concatenate their contents
    const allTexts: string[] = [];
    for (const jsonlFile of jsonlFiles) {
        const file = Bun.file(jsonlFile.path);
        const text = await file.text();
        allTexts.push(text);
    }
    
    // Join all texts with newlines
    const combinedText = allTexts.join('\n');
    
    return { text: combinedText, files: jsonlFiles };
}