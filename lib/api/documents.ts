import { apiRequest } from './client';

export interface DocumentInfo {
  id: string;
  reqId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface DocumentDto {
  id: string;
  req_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

function fromDto(dto: DocumentDto): DocumentInfo {
  return {
    id: dto.id,
    reqId: dto.req_id,
    filename: dto.filename,
    contentType: dto.content_type,
    sizeBytes: dto.size_bytes,
    uploadedAt: dto.uploaded_at,
  };
}

export async function uploadDocument(file: File, reqId: string): Promise<DocumentInfo> {
  const formData = new FormData();
  formData.append('req_id', reqId);
  formData.append('file', file);
  const dto = await apiRequest<DocumentDto>('/documents/upload', { method: 'POST', body: formData });
  return fromDto(dto);
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const dtos = await apiRequest<DocumentDto[]>('/documents');
  return dtos.map(fromDto);
}
