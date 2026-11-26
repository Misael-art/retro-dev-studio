import { invoke } from "@tauri-apps/api/core";
import type { CodeDocument, CodeEditReceipt, CodeEditTransaction } from "../codeDocument";

/** Projeta o documento de código (Experimental) da cena em memória, sem gravar nada. */
export function projectCodeDocument(projectDir: string, sceneJson: string): Promise<CodeDocument> {
  return invoke<CodeDocument>("code_document_project", { projectDir, sceneJson });
}

/** Analisa uma transação de edição; o backend não grava nem muta a cena. */
export function analyzeCodeEdit(
  projectDir: string,
  sceneJson: string,
  transaction: CodeEditTransaction,
): Promise<CodeEditReceipt> {
  return invoke<CodeEditReceipt>("code_edit_analyze", { projectDir, sceneJson, transaction });
}
