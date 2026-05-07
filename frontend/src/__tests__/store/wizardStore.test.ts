import { describe, test, expect, beforeEach } from 'vitest';
import { useWizardStore } from '../../store/wizardStore';

describe('wizardStore — estado inicial', () => {
  beforeEach(() => useWizardStore.getState().reset());

  test('step inicia en 1', () => {
    expect(useWizardStore.getState().step).toBe(1);
  });

  test('vehicle.uso default es Particular', () => {
    expect(useWizardStore.getState().vehicle.uso).toBe('Particular');
  });

  test('tomador.tipoDoc default es V', () => {
    expect(useWizardStore.getState().tomador.tipoDoc).toBe('V');
  });

  test('sameInsured default es true', () => {
    expect(useWizardStore.getState().sameInsured).toBe(true);
  });

  test('paymentMethod default es mobile', () => {
    expect(useWizardStore.getState().paymentMethod).toBe('mobile');
  });
});

describe('wizardStore — navegación', () => {
  beforeEach(() => useWizardStore.getState().reset());

  test('nextStep incrementa step', () => {
    useWizardStore.getState().nextStep();
    expect(useWizardStore.getState().step).toBe(2);
  });

  test('prevStep decrementa pero no baja de 1', () => {
    useWizardStore.getState().prevStep();
    expect(useWizardStore.getState().step).toBe(1);
  });

  test('nextStep no pasa de 6', () => {
    const s = useWizardStore.getState();
    for (let i = 0; i < 10; i++) s.nextStep();
    expect(useWizardStore.getState().step).toBeLessThanOrEqual(6);
  });

  test('goTo salta directamente', () => {
    useWizardStore.getState().goTo(4);
    expect(useWizardStore.getState().step).toBe(4);
  });
});

describe('wizardStore — vehicle', () => {
  beforeEach(() => useWizardStore.getState().reset());

  test('setVehicle hace merge con datos existentes', () => {
    const s = useWizardStore.getState();
    s.setVehicle({ marca: 'Toyota' });
    s.setVehicle({ modelo: 'Corolla' });
    expect(useWizardStore.getState().vehicle.marca).toBe('Toyota');
    expect(useWizardStore.getState().vehicle.modelo).toBe('Corolla');
  });

  test('cambiar placa invalida la quote previa', () => {
    const s = useWizardStore.getState();
    s.setVehicle({ marca: 'Toyota', modelo: 'Corolla', año: '2020', placa: 'AE123KT' });
    s.setQuote(
      { mprima: 1000, mprimaext: 25, ptasa: 0.005 },
      'AE123KT|TOYOTA|COROLLA|2020|PARTICULAR||',
    );
    expect(useWizardStore.getState().quote).not.toBeNull();
    s.setVehicle({ placa: 'OTRA456' });
    expect(useWizardStore.getState().quote).toBeNull();
  });

  test('cambiar ccategoria_uso invalida quote previa', () => {
    const s = useWizardStore.getState();
    s.setVehicle({ marca: 'Toyota', modelo: 'Corolla', año: '2020', placa: 'AE123KT' });
    s.setQuote(
      { mprima: 1000, mprimaext: 25, ptasa: 0.005 },
      'AE123KT|TOYOTA|COROLLA|2020|PARTICULAR||',
    );
    s.setVehicle({ ccategoria_uso: 4 });
    expect(useWizardStore.getState().quote).toBeNull();
  });

  test('cambios irrelevantes (color) NO invalidan la quote', () => {
    const s = useWizardStore.getState();
    s.setVehicle({ marca: 'Toyota', modelo: 'Corolla', año: '2020', placa: 'AE123KT' });
    s.setQuote(
      { mprima: 1000, mprimaext: 25, ptasa: 0.005 },
      'AE123KT|TOYOTA|COROLLA|2020|PARTICULAR||',
    );
    s.setVehicle({ color: 'Rojo' });
    expect(useWizardStore.getState().quote).not.toBeNull();
  });
});

describe('wizardStore — documentos y reset', () => {
  beforeEach(() => useWizardStore.getState().reset());

  test('setDocState actualiza solo el documento indicado', () => {
    const s = useWizardStore.getState();
    s.setDocState('cedula', { status: 'done', progress: 100 });
    const state = useWizardStore.getState();
    expect(state.documents.cedula.status).toBe('done');
    expect(state.documents.licencia.status).toBe('idle');
  });

  test('reset() limpia todo el estado', () => {
    const s = useWizardStore.getState();
    s.goTo(5);
    s.setVehicle({ placa: 'ABC123' });
    s.setDocState('cedula', { status: 'done', progress: 100 });
    s.reset();
    expect(useWizardStore.getState().step).toBe(1);
    expect(useWizardStore.getState().vehicle.placa).toBe('');
    expect(useWizardStore.getState().documents.cedula.status).toBe('idle');
  });
});

describe('wizardStore — pagador distinto', () => {
  beforeEach(() => useWizardStore.getState().reset());

  test('differentPayer default es false', () => {
    expect(useWizardStore.getState().differentPayer).toBe(false);
  });

  test('setDifferentPayer cambia el flag', () => {
    useWizardStore.getState().setDifferentPayer(true);
    expect(useWizardStore.getState().differentPayer).toBe(true);
  });

  test('setPagador hace merge en pagador', () => {
    const s = useWizardStore.getState();
    s.setPagador({ nombre: 'Otro', identificacion: '99999999' });
    expect(useWizardStore.getState().pagador.nombre).toBe('Otro');
  });
});
