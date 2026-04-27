import { useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Select } from '../../components/ui/FormField';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { SectionCard } from '../emission/EmissionStep';
import { Car, UserCog, Sparkles, ScanLine, ShieldCheck } from 'lucide-react';
import { toast } from '../../store/toastStore';

const COLOR_SWATCHES: Record<string, string> = {
  blanco: '#F8FAFC',
  negro: '#0F172A',
  gris: '#94A3B8',
  plateado: '#CBD5E1',
  rojo: '#EF4444',
  azul: '#3B82F6',
  verde: '#10B981',
  amarillo: '#F59E0B',
  marrón: '#92400E',
  beige: '#F5DEB3',
};

function getColorSwatch(name: string): string {
  if (!name) return '#E2E8F0';
  const k = name.toLowerCase().trim();
  return COLOR_SWATCHES[k] ?? '#94A3B8';
}

interface VehicleErrors {
  placa?: string;
  marca?: string;
  modelo?: string;
}

export function VehicleStep() {
  const {
    vehicle, setVehicle,
    hasDriver, setHasDriver,
    conductor, setConductor,
    documents,
  } = useWizardStore();

  const [errors, setErrors] = useState<VehicleErrors>({});
  const [verified, setVerified] = useState(false);

  const ocrCert = documents.certificado.ocr;
  const hasOcrPrefill = !!ocrCert && !!(ocrCert.placa || ocrCert.marca || ocrCert.modelo);

  const validate = () => {
    const e: VehicleErrors = {};
    if (!vehicle.placa.trim()) e.placa = 'La placa es obligatoria';
    if (!vehicle.marca.trim()) e.marca = 'La marca es obligatoria';
    if (!vehicle.modelo.trim()) e.modelo = 'El modelo es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  (window as unknown as Record<string, unknown>).__validateStep3 = validate;

  return (
    <div className="animate-fade-in space-y-5">
      {/* OCR precarga banner */}
      {hasOcrPrefill && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-4 sm:p-5 shadow-[0_18px_40px_-12px_rgba(15, 26, 90,0.32)] relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-fuchsia-300/15 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md grid place-items-center flex-shrink-0 ring-1 ring-white/20">
                <ScanLine size={18} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-black text-sm flex items-center gap-2 flex-wrap">
                  Datos del vehículo precargados
                  <span className="text-[0.6rem] font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full tracking-wider">
                    OCR · IA
                  </span>
                </p>
                <p className="text-xs text-indigo-100 mt-0.5 leading-relaxed">
                  Detectamos esta información en el certificado del vehículo. Revísala y completa lo que falte.
                </p>
              </div>
            </div>

            {!verified && (
              <button
                type="button"
                onClick={() => {
                  setVerified(true);
                  toast.success('Datos confirmados', 'Marcamos la información del vehículo como verificada.', 3000);
                }}
                className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 hover:bg-white text-indigo-700 text-xs font-bold shadow-[0_6px_16px_rgba(0,0,0,0.15)] transition-all active:scale-95"
              >
                <ShieldCheck size={14} />
                Confirmar datos
              </button>
            )}
            {verified && (
              <span className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-400/95 text-emerald-950 text-xs font-bold ring-1 ring-emerald-300">
                <ShieldCheck size={14} />
                Verificado
              </span>
            )}
          </div>
        </div>
      )}

      {/* Vehicle form */}
      <SectionCard
        Icon={Car}
        title="Datos del vehículo"
        description="Información del vehículo a asegurar"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Placa" error={errors.placa}>
            <Input
              value={vehicle.placa}
              onChange={(e) => setVehicle({ placa: e.target.value.toUpperCase() })}
              placeholder="AE123KT"
              className="uppercase font-mono tracking-wider"
            />
          </Field>

          <Field label="Año">
            <Input
              value={vehicle.año}
              onChange={(e) => setVehicle({ año: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="2020"
              inputMode="numeric"
            />
          </Field>

          <Field label="Marca" error={errors.marca}>
            <Input
              value={vehicle.marca}
              onChange={(e) => setVehicle({ marca: e.target.value })}
              placeholder="Toyota, Chevrolet, Ford..."
            />
          </Field>

          <Field label="Modelo" error={errors.modelo}>
            <Input
              value={vehicle.modelo}
              onChange={(e) => setVehicle({ modelo: e.target.value })}
              placeholder="Corolla, Aveo, Fiesta..."
            />
          </Field>

          <Field label="Color">
            <div className="relative">
              <Input
                value={vehicle.color}
                onChange={(e) => setVehicle({ color: e.target.value })}
                placeholder="Plateado"
                style={{ paddingLeft: '2.25rem' }}
              />
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-300 shadow-inner pointer-events-none"
                style={{ background: getColorSwatch(vehicle.color) }}
                aria-hidden
              />
            </div>
          </Field>

          <Field label="Uso del vehículo">
            <Select
              value={vehicle.uso}
              onChange={(e) => setVehicle({ uso: e.target.value })}
            >
              <option value="Particular">Particular</option>
              <option value="Comercial">Comercial</option>
              <option value="Carga">Carga</option>
              <option value="Transporte público">Transporte público</option>
            </Select>
          </Field>

          <Field label="Serial de carrocería (VIN)" full>
            <Input
              value={vehicle.serial}
              onChange={(e) => setVehicle({ serial: e.target.value.toUpperCase() })}
              placeholder="VIN20TOYCO2020001"
              className="font-mono uppercase tracking-wider"
            />
          </Field>
        </div>

        {/* License plate visual preview */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3 sm:gap-4 flex-wrap">
          <p className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest inline-flex items-center gap-1.5">
            <Sparkles size={11} className="text-indigo-500" />
            Vista previa
          </p>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <div className="rounded-md bg-white border-2 border-slate-900 px-3 py-1.5 font-mono font-black text-slate-900 text-sm tracking-widest shadow-sm">
              {vehicle.placa || 'AAA000'}
            </div>
            <span className="text-sm text-slate-700 font-bold truncate max-w-[200px]">
              {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Marca · Modelo'}
            </span>
            {vehicle.año && (
              <span className="text-xs text-slate-400 font-mono">{vehicle.año}</span>
            )}
            {vehicle.color && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                <span
                  className="w-3 h-3 rounded-full ring-1 ring-slate-300"
                  style={{ background: getColorSwatch(vehicle.color) }}
                />
                {vehicle.color}
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Conductor habitual */}
      <SectionCard
        Icon={UserCog}
        title="Conductor habitual"
        description="Solo si otra persona usa el vehículo frecuentemente"
      >
        <ToggleSwitch
          checked={hasDriver}
          onChange={setHasDriver}
          label="Otra persona conduce habitualmente"
          description="Activa si el vehículo tiene un conductor habitual distinto al tomador."
        />

        {hasDriver && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            <Field label="Nombre del conductor">
              <Input
                value={conductor.nombre}
                onChange={(e) => setConductor({ nombre: e.target.value })}
                placeholder="Nombre"
              />
            </Field>
            <Field label="Apellido del conductor">
              <Input
                value={conductor.apellido}
                onChange={(e) => setConductor({ apellido: e.target.value })}
                placeholder="Apellido"
              />
            </Field>
            <Field label="Número de licencia">
              <Input
                value={conductor.licencia ?? ''}
                onChange={(e) => setConductor({ licencia: e.target.value })}
                placeholder="Ej. LIC-0234567"
              />
            </Field>
            <Field label="Relación con el tomador">
              <Input
                value={conductor.relacion ?? ''}
                onChange={(e) => setConductor({ relacion: e.target.value })}
                placeholder="Familiar, empleado..."
              />
            </Field>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
