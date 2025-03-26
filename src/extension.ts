import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import * as prettier from 'prettier';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

// 创建输出通道
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('SIS XML Formatter is now active!');

    // 注册格式化命令
    const formatCommand = vscode.commands.registerCommand('sis-formatter.formatXml', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'xml') {
                vscode.commands.executeCommand('editor.action.formatDocument');
            } else {
                vscode.window.showInformationMessage('当前文档不是XML文件');
            }
        }
    });
    context.subscriptions.push(formatCommand);

    // Register the formatting provider
    const disposable = vscode.languages.registerDocumentFormattingEditProvider('xml', {
        async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
            const text = document.getText();
            try {
                // Parse the XML to handle special nodes
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                if (!xmlDoc || !xmlDoc.documentElement) {
                    throw new Error('无效的XML文档');
                }
                const parserErrors = xmlDoc.getElementsByTagName('parsererror');
                if (parserErrors.length > 0) {
                    vscode.window.showInformationMessage('XML文档解析错误:' + parserErrors[0].textContent);
                }
                // Format Style nodes (CSS content)
                const styleNodes = xmlDoc.getElementsByTagName('Style');
                if (styleNodes && styleNodes.length > 0) {
                    for (let i = 0; i < styleNodes.length; i++) {
                        const styleNode = styleNodes[i];
                        const cssContent = styleNode.textContent || '';
                        const trimmedContent = cssContent.trim();
                        if (trimmedContent) {
                            try {
                                // Calculate the indentation level for the script content
                                let indentLevel = 0;
                                let parentNode = styleNode.parentNode;
                                while (parentNode && parentNode !== xmlDoc) {
                                    indentLevel++;
                                    parentNode = parentNode.parentNode;
                                }
                                const baseIndent = '    '.repeat(indentLevel + 1);

                                const formattedCss = await prettier.format(trimmedContent, {
                                    parser: 'css',
                                    tabWidth: 4
                                });
                                // Add indentation to each line
                                const indentedJs = formattedCss
                                .split('\n')
                                .map(line => line.trim() ? baseIndent + line : line)
                                .join('\n');

                                styleNode.textContent = `\n${indentedJs}`;
                            } catch (error) {
                                // Calculate the indentation level for the script content
                                let indentLevel = 0;
                                let parentNode = styleNode.parentNode;
                                while (parentNode && parentNode !== xmlDoc) {
                                    indentLevel++;
                                    parentNode = parentNode.parentNode;
                                }
                                const baseIndent = '    '.repeat(indentLevel);
                                const contentIndent = '    '.repeat(indentLevel + 1);

                                // Add indentation to each line
                                const indentedContent = trimmedContent
                                    .split('\n')
                                    .map(line => line.trim() ? contentIndent + line : line)
                                    .join('\n');
                                styleNode.textContent = `\n${indentedContent}`;
                            }
                        }
                    }
                }

                // Get user configured script-like nodes
                const config = vscode.workspace.getConfiguration('sisFormatter');
                const scriptLikeNodes = config.get<string[]>('scriptLikeNodes') || ['Script', 'service-config'];

                // Format script-like nodes (JavaScript content)
                for (const nodeName of scriptLikeNodes) {
                    const nodes = xmlDoc.getElementsByTagName(nodeName);
                    if (nodes && nodes.length > 0) {
                        for (let i = 0; i < nodes.length; i++) {
                            const node = nodes[i];
                            const content = node.textContent || '';
                            const trimmedContent = content.trim();

                            if (trimmedContent) {
                                try {
                                    // Calculate the indentation level for the script content
                                    let indentLevel = 0;
                                    let parentNode = node.parentNode;
                                    while (parentNode && parentNode !== xmlDoc) {
                                        indentLevel++;
                                        parentNode = parentNode.parentNode;
                                    }
                                    const baseIndent = '    '.repeat(indentLevel + 1);

                                    const formattedJs = await prettier.format(trimmedContent, {
                                        parser: 'babel-ts',
                                        tabWidth: 4,
                                        printWidth: 120,
                                        bracketSameLine: true,
                                        singleAttributePerLine: false
                                    });

                                    // Add indentation to each line
                                    const indentedJs = formattedJs
                                        .split('\n')
                                        .map(line => line.trim() ? baseIndent + line : line)
                                        .join('\n');

                                    // Create a CDATA section with proper indentation
                                    const cdataSection = xmlDoc.createCDATASection(`\n${baseIndent}${indentedJs}\n${baseIndent}`);
                                    // Remove all child nodes
                                    while (node.firstChild) {
                                        node.removeChild(node.firstChild);
                                    }

                                    // Append the CDATA section
                                    node.appendChild(xmlDoc.createTextNode(`\n${baseIndent}`));
                                    node.appendChild(cdataSection);
                                    node.appendChild(xmlDoc.createTextNode(`\n${baseIndent}`));
                                } catch (error) {
                                    // Calculate the indentation level for the script content
                                    let indentLevel = 0;
                                    let parentNode = node.parentNode;
                                    while (parentNode && parentNode !== xmlDoc) {
                                        indentLevel++;
                                        parentNode = parentNode.parentNode;
                                    }
                                    const baseIndent = '    '.repeat(indentLevel);
                                    const contentIndent = '    '.repeat(indentLevel + 1);

                                    // Add indentation to each line
                                    const indentedContent = trimmedContent
                                        .split('\n')
                                        .map(line => line.trim() ? contentIndent + line : line)
                                        .join('\n');

                                    const cdataSection = xmlDoc.createCDATASection(`\n${baseIndent}${indentedContent}\n${baseIndent}`);
                                    while (node.firstChild) {
                                        node.removeChild(node.firstChild);
                                    }
                                    node.appendChild(xmlDoc.createTextNode(`\n${baseIndent}`));
                                    node.appendChild(cdataSection);
                                    node.appendChild(xmlDoc.createTextNode(`\n${baseIndent}`));
                                }
                            }
                        }
                    }
                }

                const serializer = new XMLSerializer();
                const xmlString = serializer.serializeToString(xmlDoc);

                // Format the entire XML
                const formattedXml = xmlFormatter(xmlString, {
                    indentation: '    ',
                    lineSeparator: '\n',
                    forceSelfClosingEmptyTag: true,
                    whiteSpaceAtEndOfSelfclosingTag: true,
                    throwOnFailure: true,
                    ignoredPaths: ['Style', ...scriptLikeNodes]
                });
                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );

                return [vscode.TextEdit.replace(range, formattedXml)];
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error formatting XML: ${error.message}`);
                return [];
            }
        }

    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
