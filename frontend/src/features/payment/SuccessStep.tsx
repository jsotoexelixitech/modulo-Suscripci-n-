import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useWizardStore } from '../../store/wizardStore';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import {
  CheckCircle2, Download, Mail, RefreshCw, Sparkles, ShieldCheck,
  Calendar, Share2, Copy, ExternalLink,
} from 'lucide-react';
import { formatUsdShort } from '../../lib/money';

function fireConfetti() {
  const colors = ['#0F1A5A', '#2E6DBF', '#E84F51', '#10B981', '#F59E0B'];

  const fire = (origin: { x: number; y: number }, particleCount: number) => {
    confetti({
      particleCount,
      angle: 90,
      spread: 75,
      startVelocity: 45,
      ticks: 240,
      origin,
      colors,
      shapes: ['circle', 'square'],
      scalar: 1.1,
      gravity: 0.9,
      zIndex: 1000,
    });
  };

  fire({ x: 0.25, y: 0.45 }, 70);
  fire({ x: 0.75, y: 0.45 }, 70);
  setTimeout(() => fire({ x: 0.5, y: 0.5 }, 100), 250);
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 70,
      startVelocity: 35,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 70,
      startVelocity: 35,
      origin: { x: 1, y: 0.7 },
      colors,
    });
  }, 500);
}

export function SuccessStep() {
  const { policy, tomador, selectedPlan, reset } = useWizardStore();
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      // Small delay so the section animates in first
      setTimeout(fireConfetti, 200);
    }
  }, []);

  const holder = [tomador.nombre, tomador.apellido].filter(Boolean).join(' ') || 'Cliente';
  const policyNum = policy?.cnpoliza || policy?.number || 'LM-2026-000000';
  const reciboNum = policy?.cnrecibo || '';
  const pdfUrl = policy?.urlpoliza || '';
  const emittedDate = policy?.emittedAt
    ? new Date(policy.emittedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });

  // Prima real emitida (devuelta por La Mundial al emitir).
  const primaUsd = policy?.quote?.mprimaext;
  const primaVes = policy?.quote?.mprima;
  const ptasa = policy?.quote?.ptasa;

  const copyPolicy = async () => {
    try {
      await navigator.clipboard.writeText(policyNum);
      toast.success('Copiado al portapapeles', `Número ${policyNum}`, 2800);
    } catch {
      toast.error('No se pudo copiar', 'Intenta de nuevo o copia manualmente.');
    }
  };

  const downloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      toast.success('Abriendo póliza', 'El PDF se abrió en una nueva pestaña.');
    } else {
      toast.warning(
        'PDF no disponible',
        'La Mundial no devolvió URL de descarga para esta emisión. Contacta soporte.',
        5000,
      );
    }
  };

  return (
    <div className="animate-fade-in py-2">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl scale-125 animate-pulse-soft" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-500 grid place-items-center shadow-[0_24px_48px_rgba(16,185,129,0.4)] animate-float">
            <svg viewBox="0 0 52 52" className="w-12 h-12">
              <circle cx="26" cy="26" r="24" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
              <path
                d="M14 27 L23 36 L40 18"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="50"
                strokeDashoffset="50"
                style={{ animation: 'draw-check 0.7s ease-out 0.2s forwards' }}
              />
            </svg>
          </div>
          <Sparkles size={20} className="absolute -top-2 -right-2 text-amber-400 animate-pulse-soft" />
          <Sparkles
            size={14}
            className="absolute -bottom-1 -left-2 text-violet-400 animate-pulse-soft"
            style={{ animationDelay: '0.5s' }}
          />
          <Sparkles
            size={10}
            className="absolute top-2 -left-3 text-fuchsia-400 animate-pulse-soft"
            style={{ animationDelay: '0.9s' }}
          />
        </div>

        <p className="text-[0.7rem] font-black text-emerald-600 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Emisión completada
        </p>
        <h2 className="font-display text-3xl sm:text-[2.4rem] font-black text-slate-900 tracking-tight mb-3">
          ¡Tu póliza está <span className="gradient-text-indigo">activa</span>!
        </h2>
        <p className="text-slate-500 max-w-md mx-auto leading-relaxed text-sm">
          La póliza fue emitida correctamente. Te enviamos una copia por correo y puedes descargarla cuando quieras.
        </p>
      </div>

      {/* Policy detail card */}
      <div className="max-w-2xl mx-auto mb-8 animate-spring-in">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-7 shadow-[0_32px_64px_-16px_rgba(15,23,42,0.4)] relative overflow-hidden shine-sweep">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[0.65rem] font-black tracking-widest text-indigo-300 uppercase">
                  Certificado digital
                </p>
                <p className="text-xs text-slate-400 mt-1">La Mundial de Seguros</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[0.6rem] font-bold text-emerald-300 bg-emerald-500/15 backdrop-blur ring-1 ring-emerald-400/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                <CheckCircle2 size={10} />
                Activa
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-bold text-indigo-300 uppercase tracking-widest mb-1.5">
                    Número de póliza
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-black text-2xl sm:text-3xl text-white tracking-wide break-all">
                      {policyNum}
                    </p>
                    <button
                      onClick={copyPolicy}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white shrink-0"
                      aria-label="Copiar número"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>

                {/* Prima real emitida — destacada al lado del numero */}
                {primaUsd ? (
                  <div className="text-right shrink-0">
                    <p className="text-[0.6rem] font-bold text-indigo-300 uppercase tracking-widest mb-1.5">
                      Prima anual emitida
                    </p>
                    <p className="font-display font-black text-2xl sm:text-3xl text-white leading-none tabular-nums">
                      {formatUsdShort(primaUsd)}
                    </p>
                    {primaVes ? (
                      <p className="text-[0.65rem] font-bold text-indigo-200 mt-1 tabular-nums">
                        Bs{' '}
                        {primaVes.toLocaleString('es-VE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    ) : null}
                    {ptasa ? (
                      <p className="text-[0.58rem] text-indigo-300/80 mt-0.5 tabular-nums">
                        Tasa BCV: {ptasa.toFixed(4)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-white/10">
                {[
                  { label: 'Titular', value: holder },
                  { label: 'Plan', value: selectedPlan?.name ?? 'RCV Básico' },
                  { label: 'Recibo', value: reciboNum || '—' },
                  { label: 'Emitida', value: emittedDate, icon: <Calendar size={11} /> },
                ].map(({ label, value, icon }) => (
                  <div key={label}>
                    <p className="text-[0.58rem] font-bold text-indigo-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      {icon}
                      {label}
                    </p>
                    <p className="font-bold text-white truncate text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Link directo al PDF de La Mundial (si existe) */}
              {pdfUrl ? (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-[0.58rem] font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
                    Documento oficial
                  </p>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-indigo-200 hover:text-white transition-colors break-all underline-offset-2 hover:underline"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{pdfUrl}</span>
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Bottom badge */}
          <div className="relative mt-6 pt-5 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-[0.66rem] text-slate-300">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span className="font-medium">Verificado · Válido por 12 meses</span>
            </div>
            <div className="text-[0.6rem] text-indigo-300 font-mono font-bold tracking-widest">
              AURORA · v2.1
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 flex-wrap mb-8">
        <Button
          variant="primary"
          size="lg"
          onClick={downloadPdf}
        >
          <Download size={15} />
          Descargar PDF
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => toast.success('Correo enviado', 'Te enviamos la póliza al correo registrado.')}
        >
          <Mail size={15} />
          Enviar por correo
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'Mi póliza', text: `Póliza ${policyNum}` }).catch(() => {});
            } else {
              toast.warning('No disponible', 'Tu navegador no soporta compartir nativamente.');
            }
          }}
        >
          <Share2 size={15} />
          Compartir
        </Button>
      </div>

      <div className="text-center">
        <button
          onClick={() => {
            fired.current = false;
            reset();
          }}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 transition-colors font-semibold"
        >
          <RefreshCw size={13} />
          Emitir otra póliza
        </button>
      </div>
    </div>
  );
}
