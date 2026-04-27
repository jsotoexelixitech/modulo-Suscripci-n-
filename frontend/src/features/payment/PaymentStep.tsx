import { useEffect } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input } from '../../components/ui/FormField';
import type { PaymentMethod } from '../../types';
import {
  Building2, Smartphone, Lock, ShieldCheck,
  Check, Receipt, Sparkles,
} from 'lucide-react';

const PAYMENT_OPTIONS: {
  method: PaymentMethod;
  label: string;
  sub: string;
  Icon: React.ElementType;
}[] = [
  { method: 'transfer', label: 'Transferencia', sub: 'Referencia bancaria',    Icon: Building2 },
  { method: 'mobile',   label: 'Pago móvil',    sub: 'Rápido con tu teléfono', Icon: Smartphone },
];

export function PaymentStep() {
  const { paymentMethod, setPaymentMethod, selectedPlan } = useWizardStore();

  useEffect(() => {
    if (paymentMethod === 'card') {
      setPaymentMethod('transfer');
    }
  }, [paymentMethod, setPaymentMethod]);

  const planPrice = selectedPlan?.price.split(' ')[0] ?? '$0';

  return (
    <div className="animate-fade-in space-y-6">
      <p className="text-slate-500 text-sm leading-relaxed -mt-2">
        Confirma el método de pago y emite la póliza. La operación está cifrada de extremo a extremo.
      </p>

      {/* Compact total bar */}
      <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-violet-50/40 to-fuchsia-50/30 p-5 flex items-center justify-between flex-wrap gap-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 grid place-items-center text-white shadow-[0_8px_22px_rgba(15, 26, 90,0.32)]">
            <Receipt size={18} />
          </div>
          <div>
            <p className="text-[0.62rem] font-black tracking-widest text-indigo-600 uppercase mb-0.5">
              Total a pagar
            </p>
            <p className="font-display font-bold text-slate-900 text-sm">
              {selectedPlan?.name ?? 'Plan no seleccionado'}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-1 relative">
          <span className="text-4xl font-display font-black gradient-text-indigo leading-none">
            {planPrice}
          </span>
          <span className="text-xs text-slate-500 font-semibold pb-1">/ mes</span>
        </div>
      </div>

      {/* Payment method picker */}
      <div>
        <p className="text-[0.7rem] font-black text-slate-500 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
          <Sparkles size={11} className="text-indigo-500" />
          Método de pago
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PAYMENT_OPTIONS.map(({ method, label, sub, Icon }) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`
                group relative flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 overflow-hidden
                ${paymentMethod === method
                  ? 'border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-violet-50/40 shadow-[0_12px_30px_-8px_rgba(15, 26, 90,0.2)] -translate-y-0.5'
                  : 'border border-slate-200 bg-white hover:border-indigo-300 hover:-translate-y-0.5'
                }
              `}
            >
              {paymentMethod === method && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center shadow-md">
                  <Check size={11} className="text-white" strokeWidth={3} />
                </span>
              )}
              <div
                className={`
                  w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 transition-all
                  ${paymentMethod === method
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-500'
                  }
                `}
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm text-slate-900 leading-tight">{label}</p>
                <p className="text-[0.7rem] text-slate-500 mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment forms */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Lock size={12} className="text-emerald-500" />
            <span className="font-semibold">Conexión segura · Tus datos están protegidos</span>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 text-[0.62rem] font-bold text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">PCI-DSS</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">SSL</span>
          </span>
        </div>

        {paymentMethod === 'transfer' && (
          <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Banco emisor">
              <Input placeholder="Nombre del banco" />
            </Field>
            <Field label="Número de referencia">
              <Input placeholder="Referencia bancaria" />
            </Field>
            <Field label="Fecha de la transferencia">
              <Input type="date" />
            </Field>
            <Field label="Monto transferido">
              <Input placeholder="0.00" type="number" />
            </Field>
          </div>
        )}

        {paymentMethod === 'mobile' && (
          <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Banco">
              <Input placeholder="Banco" />
            </Field>
            <Field label="Teléfono asociado">
              <Input placeholder="04XX-XXXXXXX" type="tel" />
            </Field>
            <Field label="Cédula del pagador">
              <Input placeholder="Identificación" />
            </Field>
            <Field label="Referencia de pago">
              <Input placeholder="Código o referencia" />
            </Field>
          </div>
        )}
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 flex-wrap pt-2 text-[0.7rem] text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span className="font-semibold">Datos protegidos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={13} className="text-emerald-500" />
          <span className="font-semibold">Pago cifrado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={13} className="text-emerald-500" />
          <span className="font-semibold">Sin cargos ocultos</span>
        </div>
      </div>
    </div>
  );
}
