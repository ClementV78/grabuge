import Image from 'next/image';
import { TERRAINS, type TerrainId } from './terrains';

export function TerrainPicker({ value, onChange, disabled = false }: {
  value: TerrainId;
  onChange: (value: TerrainId) => void;
  disabled?: boolean;
}) {
  return <fieldset className="terrain-picker" disabled={disabled}>
    <legend>Terrain</legend>
    <div className="terrain-options">
      {(Object.keys(TERRAINS) as TerrainId[]).map(id => <button key={id}
        type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
        <Image src={TERRAINS[id].image} alt="" width={320} height={134} />
        <span>{TERRAINS[id].name}</span>
      </button>)}
    </div>
  </fieldset>;
}
