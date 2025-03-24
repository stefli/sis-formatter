import * as vscode from 'vscode';
import xmlFormatter from 'xml-formatter';
import * as prettier from 'prettier';
import { DOMParser } from '@xmldom/xmldom';

export function activate(context: vscode.ExtensionContext) {
    console.log('SIS XML Formatter is now active!');

    // Register the formatting provider
    const disposable = vscode.languages.registerDocumentFormattingEditProvider('xml', {
        async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
            const text = document.getText();
            try {
                // Parse the XML to handle special nodes
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                if (!xmlDoc || !xmlDoc.documentElement) {
                    throw new Error('Invalid XML document');
                }

                // Format the entire XML
                const formattedXml = xmlFormatter(text, {
                    indentation: '    ',
                    collapseContent: true,
                    lineSeparator: '\n'
                });

                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(formattedXml.length)
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

export function deactivate() {}
