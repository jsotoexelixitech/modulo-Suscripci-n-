import { useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Select, Textarea } from '../../components/ui/FormField';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { User, UserPlus, Heart } from 'lucide-react';

export function SectionCard({
  title,
  description,
  Icon,
  children,
  statusLabel,
  statusTone = 'neutral',
}: {
  title: string;
  description?: string;
  Icon: React.ElementType;
  children: React.ReactNode;
  statusLabel?: string;
  statusTone?: 'neutral' | 'warning' | 'success';
}) {
  const toneClasses =
    statusTone === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : statusTone === 'success'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3 p-4 sm:p-5 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center flex-shrink-0 shadow-[0_4px_14px_rgba(15, 26, 90,0.3)]">
          <Icon size={16} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-slate-900 text-[0.95rem] leading-tight">{title}</h3>
          {description && (
            <p className="text-[0.78rem] text-slate-500 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {statusLabel && (
          <div className="flex-shrink-0">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md border text-[0.6rem] font-bold uppercase tracking-wider ${toneClasses}`}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

interface ValidationErrors {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  email?: string;
  email2?: string;
}

export function EmissionStep() {
  const {
    tomador, setTomador,
    sameInsured, setSameInsured,
    asegurado, setAsegurado,
    hasBeneficiary, setHasBeneficiary,
    beneficiario, setBeneficiario,
  } = useWizardStore();

  const [errors, setErrors] = useState<ValidationErrors>({});

  const validate = () => {
    const newErrors: ValidationErrors = {};
    if (!tomador.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!tomador.apellido.trim()) newErrors.apellido = 'El apellido es obligatorio';
    if (!tomador.identificacion.trim()) newErrors.identificacion = 'La identificación es obligatoria';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (tomador.email.trim() && !emailRe.test(tomador.email.trim())) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (tomador.email2.trim() && tomador.email !== tomador.email2) {
      newErrors.email2 = 'Los correos no coinciden';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  (window as unknown as Record<string, unknown>).__validateStep2 = validate;

  return (
    <div className="animate-fade-in">
      <div className="space-y-5">
        {/* Tomador */}
        <SectionCard
          Icon={User}
          title="Datos del tomador"
          description="Persona que contrata y paga la póliza"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de documento">
              <Select value={tomador.tipoDoc} onChange={(e) => setTomador({ tipoDoc: e.target.value })}>
                <option value="V">V - Venezolano</option>
                <option value="E">E - Extranjero</option>
                <option value="P">P - Pasaporte</option>
              </Select>
            </Field>

            <Field label="Identificación" error={errors.identificacion}>
              <Input
                value={tomador.identificacion}
                onChange={(e) => setTomador({ identificacion: e.target.value })}
                placeholder="Ej. 18456329"
              />
            </Field>

            <Field label="Nombre" error={errors.nombre}>
              <Input
                value={tomador.nombre}
                onChange={(e) => setTomador({ nombre: e.target.value })}
                placeholder="Nombre"
              />
            </Field>

            <Field label="Apellido" error={errors.apellido}>
              <Input
                value={tomador.apellido}
                onChange={(e) => setTomador({ apellido: e.target.value })}
                placeholder="Apellido"
              />
            </Field>

            <Field label="Teléfono">
              <Input
                value={tomador.telefono}
                onChange={(e) => setTomador({ telefono: e.target.value })}
                placeholder="04XX-XXXXXXX"
                type="tel"
              />
            </Field>

            <Field label="Correo electrónico" error={errors.email}>
              <Input
                value={tomador.email}
                onChange={(e) => setTomador({ email: e.target.value })}
                placeholder="correo@ejemplo.com"
                type="email"
              />
            </Field>

            <Field label="Confirmar correo" error={errors.email2}>
              <Input
                value={tomador.email2}
                onChange={(e) => setTomador({ email2: e.target.value })}
                placeholder="Repite el correo"
                type="email"
              />
            </Field>

            <Field label="Fecha de nacimiento">
              <Input
                value={tomador.fechaNac}
                onChange={(e) => setTomador({ fechaNac: e.target.value })}
                type="date"
              />
            </Field>

            <Field label="Sexo">
              <Select value={tomador.sexo} onChange={(e) => setTomador({ sexo: e.target.value })}>
                <option value="">Seleccionar</option>
                <option>Femenino</option>
                <option>Masculino</option>
              </Select>
            </Field>

            <Field label="Estado civil">
              <Select value={tomador.estadoCivil} onChange={(e) => setTomador({ estadoCivil: e.target.value })}>
                <option value="">Seleccionar</option>
                <option>Soltero(a)</option>
                <option>Casado(a)</option>
                <option>Divorciado(a)</option>
                <option>Viudo(a)</option>
              </Select>
            </Field>

            <Field label="Estado">
              <Input
                value={tomador.estado}
                onChange={(e) => setTomador({ estado: e.target.value })}
                placeholder="Estado"
              />
            </Field>

            <Field label="Ciudad">
              <Input
                value={tomador.ciudad}
                onChange={(e) => setTomador({ ciudad: e.target.value })}
                placeholder="Ciudad"
              />
            </Field>

            <Field label="Dirección" full>
              <Textarea
                value={tomador.direccion}
                onChange={(e) => setTomador({ direccion: e.target.value })}
                placeholder="Dirección completa"
                rows={3}
              />
            </Field>
          </div>
        </SectionCard>

        {/* Asegurado */}
        <SectionCard
          Icon={UserPlus}
          title="Asegurado"
          description="Persona protegida por la póliza"
        >
          <ToggleSwitch
            checked={sameInsured}
            onChange={setSameInsured}
            label="El tomador es el mismo asegurado"
            description="Si activas esto, no necesitarás ingresar datos adicionales del asegurado."
          />

          {!sameInsured && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <Field label="Nombre del asegurado">
                <Input value={asegurado.nombre} onChange={(e) => setAsegurado({ nombre: e.target.value })} placeholder="Nombre" />
              </Field>
              <Field label="Apellido del asegurado">
                <Input value={asegurado.apellido} onChange={(e) => setAsegurado({ apellido: e.target.value })} placeholder="Apellido" />
              </Field>
              <Field label="Documento">
                <Input value={asegurado.identificacion} onChange={(e) => setAsegurado({ identificacion: e.target.value })} placeholder="Identificación" />
              </Field>
              <Field label="Fecha de nacimiento">
                <Input value={asegurado.fechaNac ?? ''} onChange={(e) => setAsegurado({ fechaNac: e.target.value })} type="date" />
              </Field>
            </div>
          )}
        </SectionCard>

        {/* Beneficiario */}
        <SectionCard
          Icon={Heart}
          title="Beneficiario"
          description="Persona que recibe beneficios en caso de siniestro"
        >
          <ToggleSwitch
            checked={hasBeneficiary}
            onChange={setHasBeneficiary}
            label="Agregar un beneficiario"
            description="Registra a una persona que reciba los beneficios relacionados con la póliza."
          />

          {hasBeneficiary && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <Field label="Nombre">
                <Input value={beneficiario.nombre} onChange={(e) => setBeneficiario({ nombre: e.target.value })} placeholder="Nombre del beneficiario" />
              </Field>
              <Field label="Apellido">
                <Input value={beneficiario.apellido} onChange={(e) => setBeneficiario({ apellido: e.target.value })} placeholder="Apellido del beneficiario" />
              </Field>
              <Field label="Documento">
                <Input value={beneficiario.identificacion} onChange={(e) => setBeneficiario({ identificacion: e.target.value })} placeholder="Identificación" />
              </Field>
              <Field label="Parentesco">
                <Input value={beneficiario.parentesco ?? ''} onChange={(e) => setBeneficiario({ parentesco: e.target.value })} placeholder="Ej. hijo, cónyuge, madre" />
              </Field>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
