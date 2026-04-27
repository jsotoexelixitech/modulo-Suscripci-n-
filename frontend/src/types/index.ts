export type DocType = 'cedula' | 'licencia' | 'certificado' | 'rif';

export type DocStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface OcrResult {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  tipoDoc?: string;
  fechaNacimiento?: string;
  sexo?: string;
  numeroLicencia?: string;
  categoria?: string;
  vencimiento?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  año?: string;
  serial?: string;
  color?: string;
  rif?: string;
  razonSocial?: string | null;
}

export interface DocumentState {
  status: DocStatus;
  progress: number;
  file?: DocumentFile;
  ocr?: OcrResult;
  error?: string;
}

export type TomadorData = {
  tipoDoc: string;
  identificacion: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  email2: string;
  fechaNac: string;
  sexo: string;
  estadoCivil: string;
  estado: string;
  ciudad: string;
  direccion: string;
};

export type PersonData = {
  nombre: string;
  apellido: string;
  identificacion: string;
  fechaNac?: string;
  parentesco?: string;
  licencia?: string;
  relacion?: string;
};

export interface Plan {
  name: string;
  price: string;
  priceNum: number;
  tag: string;
  desc: string;
  benefits: string[];
  /** Suma asegurada (USD) — máximo cubierto por la póliza */
  sumaAsegurada: number;
  /** Sufijo opcional para la suma asegurada (ej. "/unidad") */
  sumaAseguradaUnit?: string;
}

export type PaymentMethod = 'card' | 'transfer' | 'mobile';

export interface VehicleData {
  placa: string;
  marca: string;
  modelo: string;
  año: string;
  color: string;
  serial: string;
  uso: string;
}

export interface WizardState {
  step: number;
  documents: Record<DocType, DocumentState>;
  ocrDone: boolean;
  tomador: TomadorData;
  sameInsured: boolean;
  asegurado: PersonData;
  hasBeneficiary: boolean;
  beneficiario: PersonData;
  hasDriver: boolean;
  conductor: PersonData;
  vehicle: VehicleData;
  category: string;
  selectedPlan: Plan | null;
  paymentMethod: PaymentMethod;
  policy: { number: string; emittedAt: string } | null;
}
