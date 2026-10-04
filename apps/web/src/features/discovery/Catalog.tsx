import {Catalog} from '../catalog/Catalog.tsx';
import type {DiscoveryCategory} from '../../../../../packages/data/src/discovery.ts';
export function DiscoveryCatalog({category}:{category:DiscoveryCategory}){return <Catalog category={category}/>;}
