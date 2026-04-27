import { useState } from 'react';
import { useWizardStore } from './store/wizardStore';
import { SidebarNav } from './components/SidebarNav';
import { TopProgressBar } from './components/TopProgressBar';
import { AuroraBackground } from './components/AuroraBackground';
import { Toaster } from './components/Toaster';
import { WelcomeSplash } from './components/WelcomeSplash';
import { Button } from './components/ui/Button';
import { OcrStep } from './features/ocr/OcrStep';
import { EmissionStep } from './features/emission/EmissionStep';
import { VehicleStep } from './features/vehicle/VehicleStep';
import { PlansStep } from './features/plans/PlansStep';
import { PaymentStep } from './features/payment/PaymentStep';
import { SuccessStep } from './features/payment/SuccessStep';
import { emitPolicy } from './lib/api';
import { toast } from './store/toastStore';
import {
  ChevronLeft, ChevronRight, Zap,
  HelpCircle, Sparkles, ShieldCheck,
} from 'lucide-react';

const STEP_TITLES: Record<number, { eyebrow: string; title: string; sub: string }> = {
  1: {
    eyebrow: 'Paso 01 · Documentos',
    title: 'Sube tus documentos',
    sub: 'Los analizaremos con OCR y precargaremos tus datos automáticamente.',
  },
  2: {
    eyebrow: 'Paso 02 · Emisión',
    title: 'Información del cliente',
    sub: 'Verifica los datos detectados y completa lo que falte.',
  },
  3: {
    eyebrow: 'Paso 03 · Vehículo',
    title: 'Datos del vehículo',
    sub: 'Información del vehículo a asegurar y conductor habitual.',
  },
  4: {
    eyebrow: 'Paso 04 · Cobertura',
    title: 'Elige tu plan ideal',
    sub: 'Categorías diseñadas para cada perfil de uso del vehículo.',
  },
  5: {
    eyebrow: 'Paso 05 · Checkout',
    title: 'Confirma y paga',
    sub: 'Una conexión cifrada protege la operación de extremo a extremo.',
  },
  6: {
    eyebrow: 'Completado',
    title: '¡Póliza emitida!',
    sub: '',
  },
};

function useWizardNavigation() {
  const {
    step, nextStep, prevStep, goTo,
    documents, selectedPlan, category,
    tomador, paymentMethod, setPolicy,
  } = useWizardStore();

  const [emitting, setEmitting] = useState(false);

  async function handleNext() {
    if (step === 1) {
      const requiredDocs = ['cedula', 'licencia', 'certificado'] as const;
      const allDone = requiredDocs.every((d) => documents[d].status === 'done');
      if (!allDone) {
        toast.warning(
          'Documentos pendientes',
          'Procesa cédula, licencia y certificado para continuar.',
        );
        return;
      }
      nextStep();
      return;
    }

    if (step === 2) {
      const validate = (window as unknown as Record<string, unknown>).__validateStep2 as (() => boolean) | undefined;
      if (validate && !validate()) {
        toast.warning(
          'Revisa los datos',
          'Completa los campos obligatorios del cliente.',
        );
        return;
      }
      nextStep();
      return;
    }

    if (step === 3) {
      const validate = (window as unknown as Record<string, unknown>).__validateStep3 as (() => boolean) | undefined;
      if (validate && !validate()) {
        toast.warning(
          'Datos del vehículo incompletos',
          'Completa placa, marca y modelo.',
        );
        return;
      }
      nextStep();
      return;
    }

    if (step === 4) {
      if (!category || !selectedPlan) {
        toast.warning(
          'Selecciona un plan',
          'Elige una categoría y un plan para continuar.',
        );
        return;
      }
      nextStep();
      return;
    }

    if (step === 5) {
      setEmitting(true);
      try {
        const result = await emitPolicy({
          tomador: { nombre: tomador.nombre, apellido: tomador.apellido, identificacion: tomador.identificacion },
          plan: { name: selectedPlan?.name ?? '', price: selectedPlan?.price ?? '' },
          payment: { method: paymentMethod },
        });
        setPolicy({ number: result.policy.number, emittedAt: result.policy.emittedAt });
        toast.success('¡Póliza emitida!', `Número ${result.policy.number}`, 5500);
        goTo(6);
      } catch {
        toast.error(
          'No pudimos emitir la póliza',
          'Verifica tu conexión e inténtalo de nuevo.',
        );
      } finally {
        setEmitting(false);
      }
    }
  }

  return { step, handleNext, handlePrev: prevStep, emitting };
}

export default function App() {
  const step = useWizardStore((s) => s.step);
  const { handleNext, handlePrev, emitting } = useWizardNavigation();

  const isLastStep = step === 5;
  const isSuccess = step === 6;
  const meta = STEP_TITLES[step];

  return (
    <div className="min-h-screen relative">
      <WelcomeSplash />
      <Toaster />
      <AuroraBackground />
      <TopProgressBar />

      <div className="lg:flex">
        <SidebarNav />

        <main className="flex-1 lg:ml-[300px] min-h-screen pt-[72px] lg:pt-20 px-4 sm:px-6 lg:px-10 pb-32 lg:pb-12">
          <div className="max-w-5xl mx-auto">
            {/* Glass header */}
            {!isSuccess && (
              <header className="mb-8 animate-fade-in">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-black tracking-[0.22em] gradient-text-indigo uppercase mb-2 inline-flex items-center gap-1.5">
                      <Sparkles size={11} className="text-indigo-500" />
                      {meta.eyebrow}
                    </p>
                    <h1 className="font-display text-3xl sm:text-[2.5rem] font-black text-slate-900 tracking-tight leading-tight">
                      {meta.title}
                    </h1>
                    {meta.sub && (
                      <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
                        {meta.sub}
                      </p>
                    )}
                  </div>

                  {/* Help pill */}
                  <button
                    type="button"
                    onClick={() => toast.info('Centro de ayuda', 'Disponible próximamente. Escríbenos a soporte@lamundial.com', 4000)}
                    className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full glass-light text-slate-600 hover:text-indigo-600 text-xs font-bold transition-all hover:-translate-y-0.5"
                  >
                    <HelpCircle size={13} />
                    ¿Necesitas ayuda?
                  </button>
                </div>
              </header>
            )}

            {/* Content card */}
            <section
              key={step}
              className="surface-card overflow-hidden step-enter"
            >
              <div className="p-6 sm:p-8 lg:p-10">
                {step === 1 && <OcrStep />}
                {step === 2 && <EmissionStep />}
                {step === 3 && <VehicleStep />}
                {step === 4 && <PlansStep />}
                {step === 5 && <PaymentStep />}
                {step === 6 && <SuccessStep />}
              </div>

              {!isSuccess && (
                <div className="hidden md:flex items-center justify-between gap-4 px-8 lg:px-10 py-5 border-t border-slate-100/80 bg-gradient-to-b from-slate-50/50 to-white/40 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShieldCheck size={13} className="text-emerald-500" />
                    <span className="font-medium">
                      Cifrado de extremo a extremo · TLS 1.3
                    </span>
                  </div>
                  <div className="flex gap-3">
                    {step > 1 && (
                      <Button variant="secondary" onClick={handlePrev}>
                        <ChevronLeft size={15} />
                        Atrás
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      onClick={handleNext}
                      disabled={emitting}
                      className="min-w-[180px]"
                    >
                      {emitting ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin-slow" />
                          Emitiendo póliza...
                        </>
                      ) : isLastStep ? (
                        <>
                          <Zap size={15} fill="currentColor" />
                          Emitir póliza
                        </>
                      ) : (
                        <>
                          Continuar
                          <ChevronRight size={15} />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>

      {/* Mobile sticky footer */}
      {!isSuccess && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" className="flex-1" onClick={handlePrev}>
                <ChevronLeft size={15} />
                Atrás
              </Button>
            )}
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleNext}
              disabled={emitting}
            >
              {emitting ? 'Emitiendo...' : isLastStep ? 'Emitir' : 'Continuar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
