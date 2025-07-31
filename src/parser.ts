export interface ParsedCardContent { answerMd: string; contextMd: string; }
export function parseCardContent(fullContent: string): ParsedCardContent {
    const lines = fullContent.trim().split('\n'), answerLines: string[] = [], contextLines: string[] = [], listRegex = /^(\s*)(([-*]|\d+\.)\s+)/;
    for (const line of lines) {
        const match = line.match(listRegex);
        if (match && match[1].length > 0) contextLines.push(line);
        else answerLines.push(line);
    }
    return { answerMd: answerLines.join('\n'), contextMd: contextLines.join('\n') };
}