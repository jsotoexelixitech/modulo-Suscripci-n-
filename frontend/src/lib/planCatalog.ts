import type { Plan } from '../types';

/**
 * Catálogo de planes RCV — La Mundial de Seguros.
 *
 * RCVBAS : Responsabilidad Civil Vehicular Básico (plan por defecto).
 * RUSPAT : RCV con cobertura adicional de pasajeros.
 *
 * La prima real se obtiene de la API de cotización de La Mundial
 * (mprima en Bs, mprimaext en USD). Los valores de `priceNum` aquí
 * son solo un placeholder visual mientras carga la cotización real.
 * La frecuencia en RCV es SIEMPRE anual.
 */
export const PLAN_CATALOG: Record<string, Plan[]> = {
  personal: [
    {
      name: 'RCV Básico',
      price: 'Tarifa La Mundial',
      priceNum: 0,
      tag: 'Uso personal',
      desc: 'Cobertura de Responsabilidad Civil Vehicular para uso particular. Incluye daños a terceros en bienes y personas conforme a la Ley.',
      benefits: [
        'Daños materiales a terceros',
        'Daños corporales a terceros',
        'Gastos de defensa jurídica',
        'Asistencia en el lugar del accidente',
      ],
      sumaAsegurada: 0,
    },
    {
      name: 'RCV con Pasajeros',
      price: 'Tarifa La Mundial',
      priceNum: 0,
      tag: 'Cobertura ampliada',
      desc: 'RCV Básico más cobertura adicional para lesiones de pasajeros transportados en el vehículo asegurado.',
      benefits: [
        'Todo lo del RCV Básico',
        'Lesiones corporales a pasajeros',
        'Gastos médicos de pasajeros',
        'Mayor límite de responsabilidad',
      ],
      sumaAsegurada: 0,
    },
  ],
  comercial: [
    {
      name: 'RCV Básico Comercial',
      price: 'Tarifa La Mundial',
      priceNum: 0,
      tag: 'Uso comercial',
      desc: 'Cobertura RCV para vehículos de uso comercial, carga liviana y transporte de mercancías.',
      benefits: [
        'Daños materiales a terceros',
        'Daños corporales a terceros',
        'Gastos de defensa jurídica',
        'Válido para uso comercial liviano',
      ],
      sumaAsegurada: 0,
    },
    {
      name: 'RCV con Pasajeros Comercial',
      price: 'Tarifa La Mundial',
      priceNum: 0,
      tag: 'Comercial ampliado',
      desc: 'RCV para uso comercial con cobertura adicional de pasajeros y personal a bordo.',
      benefits: [
        'Todo lo del RCV Básico Comercial',
        'Lesiones a pasajeros y personal',
        'Mayor límite de responsabilidad',
        'Adecuado para transporte de personas',
      ],
      sumaAsegurada: 0,
    },
  ],
  flota: [
    {
      name: 'RCV Flota',
      price: 'Tarifa La Mundial',
      priceNum: 0,
      tag: 'Multiunidad',
      desc: 'Póliza RCV individual para cada unidad dentro de una flota empresarial. Tarifa por vehículo según catálogo INMA.',
      benefits: [
        'Daños materiales a terceros',
        'Daños corporales a terceros',
        'Gestión centralizada por empresa',
        'Tarifa por unidad según catálogo',
      ],
      sumaAsegurada: 0,
      sumaAseguradaUnit: '/ unidad',
    },
  ],
};

export const CATEGORY_LABELS: Record<string, string> = {
  personal:  'Uso personal',
  comercial: 'Uso comercial / carga',
  flota:     'Flota empresarial',
};
