import * as vscode from 'vscode';
import * as prettier from 'prettier';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import xmlFormatter from 'xml-formatter';

// 节点配置（CDATA节点列表 + 格式化规则）
const NODE_CONFIG = {
    cdataNodes: ['Script', 'service-config', 'Validation', 'Html'],
    formatterRules: {
        'Style': { parser: 'css', tabWidth: 4 },
        'Script': { parser: 'babel', tabWidth: 4, printWidth: 120 },
        'service-config': { parser: 'babel', tabWidth: 4, printWidth: 120 },
        'Validation': { parser: 'json', tabWidth: 4 },
        'Html': { parser: 'html' }
    }
};

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('xml', {
        async provideDocumentFormattingEdits(document: vscode.TextDocument) {
            try {
                const xmlDoc = new DOMParser().parseFromString(document.getText(), 'text/xml');

                // 处理所有配置节点
                await Promise.all(Object.entries(NODE_CONFIG.formatterRules).map(
                    async ([nodeName, options]) => {
                        const nodes = xmlDoc.getElementsByTagName(nodeName);

                        for (let i = 0; i < nodes.length; i++) {
                            const node = nodes[i];
                            const indent = calculateIndent(node);
                            const content = extractNodeContent(node, nodeName);

                            if (content) {
                                const formatted = await formatWithFallback(content, options);
                                applyFormattedContent(node, formatted, indent, nodeName);
                            }
                        }
                    }
                ));

                return [createFullDocumentEdit(document, xmlDoc)];
            } catch (error) {
                vscode.window.showErrorMessage(`Formatting error: ${error instanceof Error ? error.message : error}`);
                return [];
            }
        }
    }));
}

// 计算节点缩进层级（4空格为单位）
function calculateIndent(node: Element): string {
    let level = 0;
    let parent: Node | null = node.parentNode;
    while (parent && parent.nodeName !== '#document') {
        level++;
        parent = parent.parentNode;
    }
    return ' '.repeat(level * 4);
}

function extractNodeContent(node: Element, nodeName: string): string {
    // 1. 区分 CDATA 节点和普通节点
    if (NODE_CONFIG.cdataNodes.includes(nodeName)) {
        // 2. 定位 CDATA 节点（XML CDATA 节点类型为 4）
        const cdata = Array.from(node.childNodes).find(n => n.nodeType === 4);
        let content = cdata?.nodeValue?.trim() || '';

        // 3. 替换 XML 注释为 JS 注释（针对 CDATA 内部内容）
        content = content.replace(
            /<!--\s*([\s\S]*?)\s*-->/g,
            (match, p1) => p1.split('\n').map((line: string) => `// ${line.trim()}`).join('\n')
        );

        return content;
    }
    // 4. 普通节点直接返回文本内容（保留原始 XML 注释）
    return node.textContent?.trim() || '';
}

// 带错误降级的格式化方法
async function formatWithFallback(content: string, options: prettier.Options): Promise<string> {
    try {
        return await prettier.format(content, {
            ...options,
            plugins: [require('prettier/parser-postcss')] // 加载CSS解析器
        });
    } catch {
        return content; // 失败时返回原始内容
    }
}

// 应用格式化后的内容到节点
function applyFormattedContent(node: Element, content: string, indent: string, nodeName: string) {
    const formattedLines = content.split('\n')
        .map(line => line.trim() ? `${indent}${line}` : '')
        .join('\n');

    if (NODE_CONFIG.cdataNodes.includes(nodeName)) {
        // CDATA节点处理
        const nodeIndent = indent; // 父节点缩进，如4空格
        const contentIndent = indent + '    '; // 内容缩进，如8空格

        // 构建CDATA内容：每行添加额外缩进
        const cdataContent = content.split('\n')
            .map(line => line.trim() ? `${contentIndent}${line}` : '')
            .join('\n');

        // 创建带格式的CDATA部分
        const cdata = node.ownerDocument!.createCDATASection(`\n${cdataContent}${nodeIndent}`);

        // 清空并重建节点结构
        node.textContent = '';
        node.appendChild(node.ownerDocument!.createTextNode(`\n${nodeIndent}`));
        node.appendChild(cdata);
        node.appendChild(node.ownerDocument!.createTextNode(`\n${nodeIndent}`));
    } else {
        // 普通节点处理（如Style）
        node.textContent = `\n${formattedLines}${indent}`;
    }
}

// 创建全文档范围的编辑操作
function createFullDocumentEdit(document: vscode.TextDocument, xmlDoc: Document): vscode.TextEdit {
    const xmlString = new XMLSerializer().serializeToString(xmlDoc);
    const formattedXml = xmlFormatter(xmlString, {
        indentation: '    ',
        ignoredPaths: Object.keys(NODE_CONFIG.formatterRules)
    });
    return vscode.TextEdit.replace(
        new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        ),
        formattedXml
    );
}

export function deactivate() { }