import { useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { PLAN_CATALOG, CATEGORY_LABELS } from '../../lib/planCatalog';
import {
  Check, Star, Briefcase, Truck, User as UserIcon, Crown,
  Shield, TrendingDown, ChevronDown, ShieldCheck, Sparkles,
} from 'lucide-react';
import type { Plan } from '../../types';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  personal: UserIcon,
  premium: Crown,
  comercial: Briefcase,
  flota: Truck,
};

export function PlansStep() {
  const { category, setCategory, selectedPlan, setSelectedPlan } = useWizardStore();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const plans = category ? PLAN_CATALOG[category] ?? [] : [];

  const monthlyPrice = selectedPlan?.priceNum ?? 0;
  const displayPrice = billing === 'annual' ? Math.round(monthlyPrice * 10) : monthlyPrice;
  const annualSavings = monthlyPrice * 2;

  const CategoryIcon = category ? (CATEGORY_ICONS[category] ?? UserIcon) : Shield;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap -mt-2">
        <p className="text-slate-500 text-sm leading-relaxed max-w-md">
          Selecciona la categoría y el plan que mejor se ajuste a tu vehículo.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              className={`
                relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                ${billing === b
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }
              `}
            >
              {b === 'monthly' ? 'Mensual' : 'Anual'}
              {b === 'annual' && (
                <span className="ml-1.5 inline-flex items-center text-[0.6rem] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                  -16%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Combo selectors row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category select */}
        <div>
          <label className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <Shield size={11} className="text-indigo-500" />
            Categoría de uso
          </label>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white shadow-[0_4px_14px_rgba(15, 26, 90,0.3)] pointer-events-none">
              <CategoryIcon size={15} strokeWidth={2.2} />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full pl-14 pr-10 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="">Selecciona categoría...</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Plan select */}
        <div>
          <label className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <Star size={11} className="text-violet-500" />
            Plan de cobertura
          </label>
          <div className="relative group">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg grid place-items-center pointer-events-none transition-all ${
              selectedPlan
                ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_14px_rgba(46, 109, 191,0.3)]'
                : 'bg-slate-100 text-slate-400'
            }`}>
              <Check size={15} strokeWidth={2.5} />
            </div>
            <select
              value={selectedPlan?.name ?? ''}
              onChange={(e) => {
                const p = plans.find((p) => p.name === e.target.value);
                setSelectedPlan(p ?? null);
              }}
              disabled={!category || plans.length === 0}
              className="w-full pl-14 pr-10 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {category ? 'Selecciona un plan...' : 'Primero elige categoría'}
              </option>
              {plans.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · ${p.priceNum}/mes
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Plan detail card */}
      {selectedPlan ? (
        <PlanDetailCard
          plan={selectedPlan}
          billing={billing}
          displayPrice={displayPrice}
          annualSavings={annualSavings}
        />
      ) : (
        <div className="text-center py-14 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50/70 to-white">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 grid place-items-center mx-auto mb-3 shadow-sm">
            <Shield size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {category
              ? 'Elige un plan en el combo para ver los detalles de cobertura.'
              : 'Selecciona una categoría y luego un plan para continuar.'}
          </p>
        </div>
      )}
    </div>
  );
}

function PlanDetailCard({
  plan, billing, displayPrice, annualSavings,
}: {
  plan: Plan;
  billing: 'monthly' | 'annual';
  displayPrice: number;
  annualSavings: number;
}) {
  return (
    <article className="relative rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-50/90 via-violet-50/40 to-white p-4 sm:p-6 shadow-[0_24px_48px_-12px_rgba(15,26,90,0.22)] animate-spring-in overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-fuchsia-500/12 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-indigo-500/12 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl gradient-border pointer-events-none" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-5 mb-5">
          <div className="min-w-0 flex-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-white text-slate-500 text-[0.62rem] font-bold mb-2 uppercase tracking-wider border border-slate-200">
              {plan.tag}
            </span>
            <h3 className="font-display font-black text-slate-900 text-xl sm:text-2xl leading-tight break-words">{plan.name}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md">{plan.desc}</p>
          </div>

          {/* Right column: price + suma asegurada
             En mobile ocupa todo el ancho debajo; en sm+ va a la derecha. */}
          <div className="w-full sm:w-auto sm:shrink-0 sm:max-w-[260px] flex flex-col items-stretch sm:items-end gap-3">
            {/* Price */}
            <div className="text-left sm:text-right">
              <div className="flex items-end gap-1 sm:justify-end">
                <span className="text-base sm:text-[1.2rem] font-display font-black text-slate-400 leading-none pb-1 sm:pb-2">$</span>
                <span className="text-4xl sm:text-5xl font-display font-black gradient-text-indigo leading-none tabular-nums">
                  <AnimatedCounter value={displayPrice} duration={500} />
                </span>
                <span className="text-[0.7rem] text-slate-400 font-semibold pb-1.5 sm:hidden">
                  / {billing === 'monthly' ? 'mes' : 'año'}
                </span>
              </div>
              <p className="hidden sm:block text-[0.7rem] text-slate-400 font-semibold mt-1">
                / {billing === 'monthly' ? 'mes' : 'año'}
              </p>
              {billing === 'annual' && annualSavings > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 text-[0.62rem] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  <TrendingDown size={10} />
                  Ahorras ${annualSavings}
                </span>
              )}
            </div>

            {/* Suma asegurada — premium stat card */}
            <SumaAseguradaCard plan={plan} billing={billing} />
          </div>
        </div>

        <div className="divider-soft mb-5" />

        {/* Coverage / benefits */}
        <p className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
          <Shield size={11} className="text-indigo-500" />
          Cobertura incluida
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {plan.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-xs text-slate-700">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white grid place-items-center flex-shrink-0 mt-0.5 shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
                <Check size={9} strokeWidth={3.5} />
              </span>
              <span className="leading-relaxed font-medium">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 pt-4 border-t border-indigo-100/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-indigo-600">
            <Shield size={11} />
            Plan seleccionado
          </div>
          <div className="text-[0.62rem] text-slate-400 font-medium">
            Pagas {billing === 'monthly' ? 'mensualmente' : 'anualmente · 2 meses gratis'}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Tarjeta destacada con la suma asegurada del plan.
 * — Estética premium navy con highlights muy sutiles.
 * — Reacciona al toggle mensual/anual: anual aplica +10% como bono
 *   de fidelidad (consistente con el descuento -16% del precio).
 */
function SumaAseguradaCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: 'monthly' | 'annual';
}) {
  const ANNUAL_BONUS = 0.10;
  const isAnnual = billing === 'annual';
  const displayValue = isAnnual
    ? Math.round(plan.sumaAsegurada * (1 + ANNUAL_BONUS))
    : plan.sumaAsegurada;
  const bonusAmount = displayValue - plan.sumaAsegurada;

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-700 to-violet-700 p-4 sm:p-5 shadow-[0_22px_42px_-14px_rgba(9,17,51,0.6)] ring-1 ring-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_55%)] pointer-events-none" />
      <div className="absolute -bottom-20 -right-12 w-44 h-44 rounded-full bg-fuchsia-500/18 blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-24 h-px bg-gradient-to-l from-white/40 to-transparent pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
          <span className="inline-flex items-center gap-2 text-[0.58rem] sm:text-[0.6rem] font-black text-white uppercase tracking-[0.18em] sm:tracking-[0.2em] min-w-0">
            <span className="w-6 h-6 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20 backdrop-blur shrink-0">
              <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="truncate">Suma asegurada</span>
          </span>
          <span className="text-[0.55rem] font-black text-white/85 tracking-[0.2em] bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md ring-1 ring-white/15 shrink-0">
            USD
          </span>
        </div>

        {/* Valor principal */}
        <div className="flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-lg sm:text-xl font-display font-black text-white/55 leading-none pb-0.5 sm:pb-1">$</span>
          <span className="font-display font-black text-white text-[1.85rem] sm:text-[2.3rem] leading-none tabular-nums tracking-tight break-all">
            <AnimatedCounter value={displayValue} duration={650} />
          </span>
        </div>

        {/* Sub-info */}
        <div className="mt-2.5 sm:mt-3 flex flex-wrap items-end justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] sm:text-[0.6rem] font-bold text-white/75 tracking-[0.16em] sm:tracking-[0.18em] uppercase leading-tight">
              {plan.sumaAseguradaUnit
                ? `Cobertura máx. ${plan.sumaAseguradaUnit}`
                : 'Cobertura máxima por siniestro'}
            </p>
            {isAnnual && (
              <p className="text-[0.6rem] font-semibold text-white/55 mt-1 leading-tight tabular-nums">
                Base ${plan.sumaAsegurada.toLocaleString('es-VE')} +{' '}
                <span className="text-emerald-300 font-bold">
                  ${bonusAmount.toLocaleString('es-VE')} bono
                </span>
              </p>
            )}
          </div>

          {isAnnual && (
            <span className="inline-flex items-center gap-1 text-[0.55rem] font-black text-emerald-100 bg-emerald-500/20 px-2 py-1 rounded-md ring-1 ring-emerald-300/40 tracking-wider whitespace-nowrap shrink-0">
              <Sparkles size={9} strokeWidth={2.6} />
              +10% ANUAL
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
