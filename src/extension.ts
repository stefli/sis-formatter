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
                        if (cssContent.trim()) {
                            try {
                                const formattedCss = await prettier.format(cssContent.trim(), {
                                    parser: 'css',
                                    tabWidth: 4
                                });
                                styleNode.textContent = `\n${formattedCss}`;
                            } catch (error) {
                                styleNode.textContent = `\n${cssContent}`;
                            }
                        }
                    }
                }

                // Format Script nodes (JavaScript content)
                const scriptNodes = xmlDoc.getElementsByTagName('Script');
                if (scriptNodes && scriptNodes.length > 0) {
                    for (let i = 0; i < scriptNodes.length; i++) {
                        const scriptNode = scriptNodes[i];
                        const content = scriptNode.textContent || '';
                        const trimmedContent = content.trim();

                        if (trimmedContent) {
                            try {
                                const formattedJs = await prettier.format(trimmedContent, {
                                    parser: 'babel-ts',
                                    tabWidth: 4,
                                    printWidth: 120,
                                    bracketSameLine: true,
                                    singleAttributePerLine: false
                                });
                                scriptNode.textContent = `\n${formattedJs}`;
                            } catch (error) {
                                scriptNode.textContent = `\n${trimmedContent}`;
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
                    ignoredPaths: ['Style', 'Script']
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
