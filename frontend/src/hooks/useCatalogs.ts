import { useEffect, useState } from 'react';
import { getEstados, getCiudades, getValrepList, type CatalogItem } from '../lib/api';

export interface Catalogs {
  estados    : CatalogItem[];
  ciudades   : CatalogItem[];
  sexos      : CatalogItem[];
  estadosCivil: CatalogItem[];
  parentescos: CatalogItem[];
  loading    : boolean;
  error      : string | null;
}

const EMPTY: Catalogs = {
  estados: [], ciudades: [], sexos: [], estadosCivil: [], parentescos: [],
  loading: true, error: null,
};

/**
 * Carga todos los catálogos de La Mundial en paralelo.
 * Usa la caché de módulo de `api.ts` → solo 1 fetch por sesión.
 */
export function useCatalogs(): Catalogs {
  const [cats, setCats] = useState<Catalogs>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getEstados(),
      getCiudades(),
      getValrepList('SEXO'),
      getValrepList('EDOCIVIL'),
      getValrepList('PARENTESCOS'),
    ])
      .then(([estados, ciudades, sexos, estadosCivil, parentescos]) => {
        if (!cancelled) {
          setCats({ estados, ciudades, sexos, estadosCivil, parentescos, loading: false, error: null });
        }
      })
      .catch((err) => {
        console.warn('[useCatalogs] Error cargando catálogos, usando fallback estático:', err.message);
        if (!cancelled) {
          setCats((prev) => ({ ...prev, loading: false, error: err.message }));
        }
      });

    return () => { cancelled = true; };
  }, []);

  return cats;
}
