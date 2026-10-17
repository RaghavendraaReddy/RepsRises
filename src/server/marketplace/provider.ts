import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { City, Gym, PackageTemplate, Professional } from '../../shared/marketplace/types.js';

/**
 * Where gyms, professionals and packages come from. The demo provider reads the bundled, clearly
 * labelled dataset; a live implementation (a partner API or your own database) returns the same
 * shapes with `demo: false` and replaces it in `createProvider`.
 */
export interface MarketplaceProvider {
  readonly name: string;
  readonly demo: boolean;
  cities(): Promise<City[]>;
  gyms(): Promise<Gym[]>;
  professionals(): Promise<Professional[]>;
  packages(): Promise<PackageTemplate[]>;
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length < 2000;
const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function checkGym(gym: unknown): asserts gym is Gym {
  if (!isObject(gym) || !str(gym.id) || !str(gym.name) || typeof gym.demo !== 'boolean' || !num(gym.lat) || !num(gym.lng) || !Array.isArray(gym.memberships) || !Array.isArray(gym.images))
    throw new Error(`Invalid gym record ${isObject(gym) ? String(gym.id) : ''}`);
  for (const plan of gym.memberships) if (!isObject(plan) || !str(plan.id) || !num(plan.price) || !Number.isInteger(plan.months) || (plan.months as number) < 1) throw new Error(`Invalid membership in ${String(gym.id)}`);
}
function checkProfessional(item: unknown): asserts item is Professional {
  if (!isObject(item) || !str(item.id) || !['trainer', 'nutritionist'].includes(item.role as string) || !num(item.rate) || !Array.isArray(item.qualifications)) throw new Error('Invalid professional record');
}

export class DemoProvider implements MarketplaceProvider {
  readonly name = 'Demonstration dataset';
  readonly demo = true;
  private cache?: Promise<{ cities: City[]; gyms: Gym[]; professionals: Professional[]; packages: PackageTemplate[] }>;
  constructor(private dir: string) {}

  private load() {
    this.cache ??= (async () => {
      const read = async (file: string) => {
        const data = JSON.parse(await readFile(join(this.dir, file), 'utf8')) as { items: unknown[] };
        if (!Array.isArray(data.items)) throw new Error(`${file} has no items`);
        return data.items;
      };
      const [cities, gyms, professionals, packages] = await Promise.all(['cities.json', 'gyms.json', 'professionals.json', 'packages.json'].map(read));
      gyms.forEach(checkGym);
      professionals.forEach(checkProfessional);
      return { cities: cities as City[], gyms: gyms as Gym[], professionals: professionals as Professional[], packages: packages as PackageTemplate[] };
    })();
    return this.cache;
  }
  async cities() { return (await this.load()).cities; }
  async gyms() { return (await this.load()).gyms; }
  async professionals() { return (await this.load()).professionals; }
  async packages() { return (await this.load()).packages; }
}

export function createProvider(root: string, dataDir?: string): MarketplaceProvider {
  return new DemoProvider(dataDir ?? join(root, 'data/demo'));
}
