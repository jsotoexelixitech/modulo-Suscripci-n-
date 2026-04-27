import axios from 'axios';
import type { DocType, OcrResult, DocumentFile } from '../types';

const api = axios.create({ baseURL: '/api' });

export interface UploadResponse {
  success: boolean;
  message: string;
  docType: DocType;
  file: DocumentFile;
  ocr: OcrResult;
}

/**
 * Uploads a document to the server with upload progress reporting.
 */
export async function uploadDocument(
  file: File,
  docType: DocType,
  onProgress: (pct: number) => void
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);

  const response = await api.post<UploadResponse>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  return response.data;
}

export interface EmitPolicyPayload {
  tomador: Record<string, string>;
  plan: { name: string; price: string };
  payment: { method: string };
}

export interface EmitPolicyResponse {
  success: boolean;
  policy: {
    number: string;
    holder: string;
    plan: string;
    price: string;
    emittedAt: string;
  };
}

export async function emitPolicy(payload: EmitPolicyPayload): Promise<EmitPolicyResponse> {
  const response = await api.post<EmitPolicyResponse>('/policies/emit', payload);
  return response.data;
}
