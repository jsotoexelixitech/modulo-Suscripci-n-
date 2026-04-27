import { create } from 'zustand';
import type {
  WizardState,
  DocType,
  DocumentState,
  TomadorData,
  PersonData,
  VehicleData,
  Plan,
  PaymentMethod,
} from '../types';

const defaultDoc = (): DocumentState => ({ status: 'idle', progress: 0 });

const defaultTomador = (): TomadorData => ({
  tipoDoc: 'V',
  identificacion: '',
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
  email2: '',
  fechaNac: '',
  sexo: '',
  estadoCivil: '',
  estado: '',
  ciudad: '',
  direccion: '',
});

const defaultPerson = (): PersonData => ({
  nombre: '',
  apellido: '',
  identificacion: '',
  fechaNac: '',
  parentesco: '',
  licencia: '',
  relacion: '',
});

const defaultVehicle = (): VehicleData => ({
  placa: '',
  marca: '',
  modelo: '',
  año: '',
  color: '',
  serial: '',
  uso: 'Particular',
});

interface WizardActions {
  goTo: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setDocState: (doc: DocType, state: Partial<DocumentState>) => void;
  setOcrDone: (done: boolean) => void;
  setTomador: (data: Partial<TomadorData>) => void;
  setSameInsured: (v: boolean) => void;
  setAsegurado: (data: Partial<PersonData>) => void;
  setHasBeneficiary: (v: boolean) => void;
  setBeneficiario: (data: Partial<PersonData>) => void;
  setHasDriver: (v: boolean) => void;
  setConductor: (data: Partial<PersonData>) => void;
  setVehicle: (data: Partial<VehicleData>) => void;
  setCategory: (c: string) => void;
  setSelectedPlan: (plan: Plan | null) => void;
  setPaymentMethod: (m: PaymentMethod) => void;
  setPolicy: (p: { number: string; emittedAt: string }) => void;
  reset: () => void;
}

const initialState: WizardState = {
  step: 1,
  documents: {
    cedula: defaultDoc(),
    licencia: defaultDoc(),
    certificado: defaultDoc(),
    rif: defaultDoc(),
  },
  ocrDone: false,
  tomador: defaultTomador(),
  sameInsured: true,
  asegurado: defaultPerson(),
  hasBeneficiary: false,
  beneficiario: defaultPerson(),
  hasDriver: false,
  conductor: defaultPerson(),
  vehicle: defaultVehicle(),
  category: '',
  selectedPlan: null,
  paymentMethod: 'transfer',
  policy: null,
};

export const useWizardStore = create<WizardState & WizardActions>()((set) => ({
  ...initialState,

  goTo: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 6) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),

  setDocState: (doc, state) =>
    set((s) => ({
      documents: {
        ...s.documents,
        [doc]: { ...s.documents[doc], ...state },
      },
    })),

  setOcrDone: (ocrDone) => set({ ocrDone }),

  setTomador: (data) =>
    set((s) => ({ tomador: { ...s.tomador, ...data } })),

  setSameInsured: (sameInsured) => set({ sameInsured }),

  setAsegurado: (data) =>
    set((s) => ({ asegurado: { ...s.asegurado, ...data } })),

  setHasBeneficiary: (hasBeneficiary) => set({ hasBeneficiary }),

  setBeneficiario: (data) =>
    set((s) => ({ beneficiario: { ...s.beneficiario, ...data } })),

  setHasDriver: (hasDriver) => set({ hasDriver }),

  setConductor: (data) =>
    set((s) => ({ conductor: { ...s.conductor, ...data } })),

  setVehicle: (data) =>
    set((s) => ({ vehicle: { ...s.vehicle, ...data } })),

  setCategory: (category) => set({ category, selectedPlan: null }),

  setSelectedPlan: (selectedPlan) => set({ selectedPlan }),

  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),

  setPolicy: (policy) => set({ policy }),

  reset: () => set(initialState),
}));
