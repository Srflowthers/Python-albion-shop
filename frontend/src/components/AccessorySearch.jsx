import React, { useState, useEffect } from 'react';

/**
 * Ayudante (Helper) para parsear IDs de Albion Online.
 * Utiliza Expresiones Regulares para separar Tier, Tipo (BAG/CAPE), Facción y Encantamiento.
 * 
 * Reglas soportadas:
 * - Mochilas comunes: T[Tier]_BAG
 * - Mochilas con encantamiento: T[Tier]_BAG@[Encantamiento]
 * - Capas comunes: T[Tier]_CAPE
 * - Capas comunes con encantamiento: T[Tier]_CAPE@[Encantamiento]
 * - Capas de Facción: T[Tier]_CAPE_[FACTION] y T[Tier]_CAPEITEM_FW_[FACTION]
 * - Capas de Facción con encantamiento: T[Tier]_CAPE_[FACTION]@[Encantamiento]
 * 
 * @param {string} itemId ID del ítem de Albion Online (ej: "T4_CAPEITEM_FW_MARTLOCK@2")
 * @returns {object|null} Objeto parseado o null si no coincide con Mochilas o Capas.
 */
export function parseAlbionId(itemId) {
  if (!itemId || typeof itemId !== 'string') return null;
  
  const cleanId = itemId.trim().toUpperCase();
  
  // Expresión regular robusta para capturar:
  // Grupo 1: Tier (4 al 8)
  // Grupo 2: Tipo (BAG, CAPE o CAPEITEM)
  // Grupo 3: Facción opcional (captura todo entre el tipo/FW y el @ o final de cadena)
  // Grupo 4: Encantamiento opcional (número del 1 al 4 tras el '@')
  const regex = /^T([4-8])_(BAG|CAPE|CAPEITEM)(?:_FW)?(?:_([A-Z0-9_]+))?(?:@([1-4]))?$/;
  const match = cleanId.match(regex);
  
  if (!match) return null;
  
  const tierNum = parseInt(match[1], 10);
  let type = match[2];
  if (type === 'CAPEITEM') type = 'CAPE'; // Unificar nomenclaturas
  
  let faction = match[3] || null;
  // Omitir sufijos de blueprints/recetas si existieran
  if (faction && faction.endsWith('_BP')) {
    faction = faction.replace(/_BP$/, '');
  }
  
  const enchantment = match[4] ? parseInt(match[4], 10) : 0;
  
  return {
    originalId: itemId,
    cleanId,
    tier: tierNum,
    type, // "BAG" o "CAPE"
    faction, // Ej: "MARTLOCK", "CAERLEON", "UNDEAD" o null
    enchantment, // 0, 1, 2, 3, 4
  };
}

// Catálogo local por defecto de Capas y Mochilas en caso de no recibir datos de API
const DEFAULT_ACCESSORIES_CATALOG = [
  // Mochilas Comunes
  "T4_BAG", "T4_BAG@1", "T4_BAG@2", "T4_BAG@3", "T4_BAG@4",
  "T5_BAG", "T5_BAG@1", "T5_BAG@2", "T5_BAG@3", "T5_BAG@4",
  "T6_BAG", "T6_BAG@1", "T6_BAG@2", "T6_BAG@3", "T6_BAG@4",
  "T7_BAG", "T7_BAG@1", "T7_BAG@2", "T7_BAG@3", "T7_BAG@4",
  "T8_BAG", "T8_BAG@1", "T8_BAG@2", "T8_BAG@3", "T8_BAG@4",
  
  // Capas Comunes
  "T4_CAPE", "T4_CAPE@1", "T4_CAPE@2", "T4_CAPE@3", "T4_CAPE@4",
  "T5_CAPE", "T5_CAPE@1", "T5_CAPE@2", "T5_CAPE@3", "T5_CAPE@4",
  "T6_CAPE", "T6_CAPE@1", "T6_CAPE@2", "T6_CAPE@3", "T6_CAPE@4",
  "T7_CAPE", "T7_CAPE@1", "T7_CAPE@2", "T7_CAPE@3", "T7_CAPE@4",
  "T8_CAPE", "T8_CAPE@1", "T8_CAPE@2", "T8_CAPE@3", "T8_CAPE@4",
  
  // Capas de Facción de Albion (FW) y especiales
  "T4_CAPEITEM_FW_MARTLOCK", "T4_CAPEITEM_FW_MARTLOCK@1", "T4_CAPEITEM_FW_MARTLOCK@2", "T4_CAPEITEM_FW_MARTLOCK@3", "T4_CAPEITEM_FW_MARTLOCK@4",
  "T4_CAPEITEM_FW_LYMHURST", "T4_CAPEITEM_FW_LYMHURST@1", "T4_CAPEITEM_FW_LYMHURST@2", "T4_CAPEITEM_FW_LYMHURST@3", "T4_CAPEITEM_FW_LYMHURST@4",
  "T4_CAPEITEM_FW_FORTSTERLING", "T4_CAPEITEM_FW_FORTSTERLING@1", "T4_CAPEITEM_FW_FORTSTERLING@2", "T4_CAPEITEM_FW_FORTSTERLING@3", "T4_CAPEITEM_FW_FORTSTERLING@4",
  "T4_CAPEITEM_FW_THETFORD", "T4_CAPEITEM_FW_THETFORD@1", "T4_CAPEITEM_FW_THETFORD@2", "T4_CAPEITEM_FW_THETFORD@3", "T4_CAPEITEM_FW_THETFORD@4",
  "T4_CAPEITEM_FW_BRIDGEWATCH", "T4_CAPEITEM_FW_BRIDGEWATCH@1", "T4_CAPEITEM_FW_BRIDGEWATCH@2", "T4_CAPEITEM_FW_BRIDGEWATCH@3", "T4_CAPEITEM_FW_BRIDGEWATCH@4",
  "T4_CAPEITEM_FW_CAERLEON", "T4_CAPEITEM_FW_CAERLEON@1", "T4_CAPEITEM_FW_CAERLEON@2", "T4_CAPEITEM_FW_CAERLEON@3", "T4_CAPEITEM_FW_CAERLEON@4",
  "T4_CAPEITEM_FW_BRECILIEN", "T4_CAPEITEM_FW_BRECILIEN@1", "T4_CAPEITEM_FW_BRECILIEN@2", "T4_CAPEITEM_FW_BRECILIEN@3", "T4_CAPEITEM_FW_BRECILIEN@4",
  "T4_CAPEITEM_HERETIC", "T4_CAPEITEM_HERETIC@1", "T4_CAPEITEM_HERETIC@2", "T4_CAPEITEM_HERETIC@3", "T4_CAPEITEM_HERETIC@4",
  "T4_CAPEITEM_UNDEAD", "T4_CAPEITEM_UNDEAD@1", "T4_CAPEITEM_UNDEAD@2", "T4_CAPEITEM_UNDEAD@3", "T4_CAPEITEM_UNDEAD@4",
  "T4_CAPEITEM_KEEPER", "T4_CAPEITEM_KEEPER@1", "T4_CAPEITEM_KEEPER@2", "T4_CAPEITEM_KEEPER@3", "T4_CAPEITEM_KEEPER@4",
  "T4_CAPEITEM_MORGANA", "T4_CAPEITEM_MORGANA@1", "T4_CAPEITEM_MORGANA@2", "T4_CAPEITEM_MORGANA@3", "T4_CAPEITEM_MORGANA@4",

  // T5 Facciones
  "T5_CAPEITEM_FW_MARTLOCK", "T5_CAPEITEM_FW_MARTLOCK@1", "T5_CAPEITEM_FW_MARTLOCK@2", "T5_CAPEITEM_FW_MARTLOCK@3", "T5_CAPEITEM_FW_MARTLOCK@4",
  "T5_CAPEITEM_FW_LYMHURST", "T5_CAPEITEM_FW_LYMHURST@1", "T5_CAPEITEM_FW_LYMHURST@2", "T5_CAPEITEM_FW_LYMHURST@3", "T5_CAPEITEM_FW_LYMHURST@4",
  "T5_CAPEITEM_FW_FORTSTERLING", "T5_CAPEITEM_FW_FORTSTERLING@1", "T5_CAPEITEM_FW_FORTSTERLING@2", "T5_CAPEITEM_FW_FORTSTERLING@3", "T5_CAPEITEM_FW_FORTSTERLING@4",
  "T5_CAPEITEM_FW_THETFORD", "T5_CAPEITEM_FW_THETFORD@1", "T5_CAPEITEM_FW_THETFORD@2", "T5_CAPEITEM_FW_THETFORD@3", "T5_CAPEITEM_FW_THETFORD@4",
  "T5_CAPEITEM_FW_BRIDGEWATCH", "T5_CAPEITEM_FW_BRIDGEWATCH@1", "T5_CAPEITEM_FW_BRIDGEWATCH@2", "T5_CAPEITEM_FW_BRIDGEWATCH@3", "T5_CAPEITEM_FW_BRIDGEWATCH@4",
  "T5_CAPEITEM_FW_CAERLEON", "T5_CAPEITEM_FW_CAERLEON@1", "T5_CAPEITEM_FW_CAERLEON@2", "T5_CAPEITEM_FW_CAERLEON@3", "T5_CAPEITEM_FW_CAERLEON@4",
  "T5_CAPEITEM_FW_BRECILIEN", "T5_CAPEITEM_FW_BRECILIEN@1", "T5_CAPEITEM_FW_BRECILIEN@2", "T5_CAPEITEM_FW_BRECILIEN@3", "T5_CAPEITEM_FW_BRECILIEN@4",
  "T5_CAPEITEM_HERETIC", "T5_CAPEITEM_HERETIC@1", "T5_CAPEITEM_HERETIC@2", "T5_CAPEITEM_HERETIC@3", "T5_CAPEITEM_HERETIC@4",
  "T5_CAPEITEM_UNDEAD", "T5_CAPEITEM_UNDEAD@1", "T5_CAPEITEM_UNDEAD@2", "T5_CAPEITEM_UNDEAD@3", "T5_CAPEITEM_UNDEAD@4",
  
  // T8 Facciones
  "T8_CAPEITEM_FW_MARTLOCK", "T8_CAPEITEM_FW_MARTLOCK@1", "T8_CAPEITEM_FW_MARTLOCK@2", "T8_CAPEITEM_FW_MARTLOCK@3", "T8_CAPEITEM_FW_MARTLOCK@4",
  "T8_CAPEITEM_FW_LYMHURST", "T8_CAPEITEM_FW_LYMHURST@1", "T8_CAPEITEM_FW_LYMHURST@2", "T8_CAPEITEM_FW_LYMHURST@3", "T8_CAPEITEM_FW_LYMHURST@4",
  "T8_CAPEITEM_FW_FORTSTERLING", "T8_CAPEITEM_FW_FORTSTERLING@1", "T8_CAPEITEM_FW_FORTSTERLING@2", "T8_CAPEITEM_FW_FORTSTERLING@3", "T8_CAPEITEM_FW_FORTSTERLING@4",
  "T8_CAPEITEM_FW_THETFORD", "T8_CAPEITEM_FW_THETFORD@1", "T8_CAPEITEM_FW_THETFORD@2", "T8_CAPEITEM_FW_THETFORD@3", "T8_CAPEITEM_FW_THETFORD@4",
  "T8_CAPEITEM_FW_BRIDGEWATCH", "T8_CAPEITEM_FW_BRIDGEWATCH@1", "T8_CAPEITEM_FW_BRIDGEWATCH@2", "T8_CAPEITEM_FW_BRIDGEWATCH@3", "T8_CAPEITEM_FW_BRIDGEWATCH@4",
  "T8_CAPEITEM_FW_CAERLEON", "T8_CAPEITEM_FW_CAERLEON@1", "T8_CAPEITEM_FW_CAERLEON@2", "T8_CAPEITEM_FW_CAERLEON@3", "T8_CAPEITEM_FW_CAERLEON@4",
  "T8_CAPEITEM_FW_BRECILIEN", "T8_CAPEITEM_FW_BRECILIEN@1", "T8_CAPEITEM_FW_BRECILIEN@2", "T8_CAPEITEM_FW_BRECILIEN@3", "T8_CAPEITEM_FW_BRECILIEN@4",
  "T8_CAPEITEM_HERETIC", "T8_CAPEITEM_HERETIC@1", "T8_CAPEITEM_HERETIC@2", "T8_CAPEITEM_HERETIC@3", "T8_CAPEITEM_HERETIC@4",
  "T8_CAPEITEM_UNDEAD", "T8_CAPEITEM_UNDEAD@1", "T8_CAPEITEM_UNDEAD@2", "T8_CAPEITEM_UNDEAD@3", "T8_CAPEITEM_UNDEAD@4",
  "T8_CAPEITEM_KEEPER", "T8_CAPEITEM_KEEPER@1", "T8_CAPEITEM_KEEPER@2", "T8_CAPEITEM_KEEPER@3", "T8_CAPEITEM_KEEPER@4",
  "T8_CAPEITEM_MORGANA", "T8_CAPEITEM_MORGANA@1", "T8_CAPEITEM_MORGANA@2", "T8_CAPEITEM_MORGANA@3", "T8_CAPEITEM_MORGANA@4"
];

// Nombres legibles en español
const FACTION_NAMES = {
  "COMMON": "Común (Sin Facción)",
  "MARTLOCK": "Martlock (Tierras Altas)",
  "LYMHURST": "Lymhurst (Bosque)",
  "FORTSTERLING": "Fort Sterling (Montaña)",
  "THETFORD": "Thetford (Pantano)",
  "BRIDGEWATCH": "Bridgewatch (Estepa)",
  "CAERLEON": "Caerleon (Bandido)",
  "BRECILIEN": "Brecilien (Nieblas)",
  "HERETIC": "Hereje",
  "UNDEAD": "No Muerto",
  "KEEPER": "Guardián",
  "MORGANA": "Morgana",
  "AVALON": "Avaloniana",
  "DEMON": "Demoníaca"
};

// Traductor de IDs a Nombres en Español para renderizado
export function getFriendlyName(parsedInfo) {
  if (!parsedInfo) return "Accesorio Desconocido";
  const { tier, type, faction, enchantment } = parsedInfo;
  
  const tierRoman = { 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII" }[tier] || tier;
  const encText = enchantment > 0 ? `.${enchantment}` : "";
  
  if (type === 'BAG') {
    return `Mochila de iniciado T${tier}${encText} (Tier ${tier})`;
  } else {
    if (!faction) {
      return `Capa común T${tier}${encText}`;
    }
    const factionFriendly = FACTION_NAMES[faction] || faction;
    return `Capa de ${factionFriendly} T${tier}${encText}`;
  }
}

// Obtiene el nombre base para indexar en la base de datos de Python (item_map)
export function getBaseDisplayName(parsedInfo) {
  if (!parsedInfo) return "";
  const { type, faction } = parsedInfo;
  if (type === 'BAG') return "Bolsa";
  if (!faction) return "Capa";
  
  const factionMappedNames = {
    "MARTLOCK": "Capa de Martlock",
    "LYMHURST": "Capa de Lymhurst",
    "FORTSTERLING": "Capa de Fort Sterling",
    "THETFORD": "Capa de Thetford",
    "BRIDGEWATCH": "Capa de Bridgewatch",
    "CAERLEON": "Capa de Caerleon",
    "BRECILIEN": "Capa de Brecilien",
    "HERETIC": "Capa hereje",
    "UNDEAD": "Capa de muerto viviente",
    "KEEPER": "Capa de guardián",
    "MORGANA": "Capa de Morgana",
    "AVALON": "Capa avaloniana",
    "DEMON": "Capa demoníaca"
  };
  return factionMappedNames[faction] || "Capa";
}

/**
 * Componente principal AccessorySearch.
 * Recibe una lista de IDs de ítems en formato string. Si no se provee, usa un listado local completo.
 */
export default function AccessorySearch({ itemsCatalog = null, onSelectItem = null }) {
  // Lista de ítems inicial
  const catalog = itemsCatalog || DEFAULT_ACCESSORIES_CATALOG;
  
  // Estado de los ítems parseados y filtrados
  const [parsedItems, setParsedItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // Filtros de búsqueda
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("ALL"); // ALL, BAG, CAPE
  const [selectedTiers, setSelectedTiers] = useState([4, 5, 6, 7, 8]); // Multi-select
  const [selectedEnchantment, setSelectedEnchantment] = useState("ALL"); // ALL, 0, 1, 2, 3, 4
  const [selectedFaction, setSelectedFaction] = useState("ALL"); // ALL, COMMON, MARTLOCK, etc.
  
  // Toast temporal para notificar copias
  const [toastMessage, setToastMessage] = useState("");

  // Parsear la base de datos de ítems al iniciar o cuando cambie el catálogo
  useEffect(() => {
    const items = catalog
      .map(id => parseAlbionId(id))
      .filter(Boolean); // Filtrar solo los válidos (Mochilas y Capas)
    setParsedItems(items);
  }, [catalog]);

  // Aplicar filtros avanzados
  useEffect(() => {
    let result = [...parsedItems];

    // 1. Filtro de Tipo (Mochila / Capa)
    if (selectedType !== "ALL") {
      result = result.filter(item => item.type === selectedType);
    }

    // 2. Filtro de Tiers (Multi-select)
    result = result.filter(item => selectedTiers.includes(item.tier));

    // 3. Filtro de Encantamiento
    if (selectedEnchantment !== "ALL") {
      result = result.filter(item => item.enchantment === parseInt(selectedEnchantment, 10));
    }

    // 4. Filtro de Facción (Solo si Capas está seleccionado o si está en ALL)
    if (selectedFaction !== "ALL") {
      if (selectedFaction === "COMMON") {
        result = result.filter(item => item.type === 'CAPE' && !item.faction);
      } else {
        result = result.filter(item => item.type === 'CAPE' && item.faction === selectedFaction);
      }
    }

    // 5. Búsqueda por texto (Busca en el ID y en el nombre legible del ítem)
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      result = result.filter(item => {
        const friendlyName = getFriendlyName(item).toLowerCase();
        const idLower = item.originalId.toLowerCase();
        const factionLabel = item.faction ? FACTION_NAMES[item.faction]?.toLowerCase() || "" : "";
        return friendlyName.includes(query) || idLower.includes(query) || factionLabel.includes(query);
      });
    }

    setFilteredItems(result);
  }, [parsedItems, searchText, selectedType, selectedTiers, selectedEnchantment, selectedFaction]);

  // Manejar click para alternar Tier en el multiselector
  const toggleTier = (tier) => {
    if (selectedTiers.includes(tier)) {
      if (selectedTiers.length > 1) {
        setSelectedTiers(selectedTiers.filter(t => t !== tier));
      }
    } else {
      setSelectedTiers([...selectedTiers, tier].sort());
    }
  };

  // Copiar ID único al portapapeles
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setToastMessage(`¡Copiado: ${id}!`);
    setTimeout(() => setToastMessage(""), 2500);
  };

  return (
    <div className="bg-albion-panel/40 border border-albion-border/80 rounded-xl p-6 shadow-2xl backdrop-blur-md text-slate-100 flex flex-col gap-6 relative overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-slate-900 border border-albion-gold text-albion-gold text-xs font-bold px-4 py-2.5 rounded shadow-lg shadow-black/80 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Medieval Header Ribbon */}
      <div className="border-b border-albion-border pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest block font-sans">Equipamiento Avanzado</span>
          <h2 className="text-xl font-bold tracking-wider text-albion-gold font-display uppercase mt-0.5">Buscador de Capas y Mochilas</h2>
        </div>
        <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase bg-slate-950/80 px-3 py-1.5 rounded border border-albion-border">
          Filtros Activos: <span className="text-albion-gold font-mono">{filteredItems.length}</span> ítems
        </div>
      </div>

      {/* Grid de Controles de Filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/50 p-5 rounded-lg border border-albion-border/40">
        
        {/* Input de búsqueda textual */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            1. Búsqueda por Nombre o ID
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej: Caerleon, T5, Mochila, etc."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-900/90 border border-albion-border focus:border-albion-gold text-xs text-slate-200 pl-4.5 pr-10 py-2.5 rounded outline-none transition-all placeholder-slate-600 font-medium"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Selector de Tipo (Tabs) */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            2. Tipo de Accesorio
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-900 border border-albion-border p-1 rounded-md">
            {[
              { id: "ALL", name: "Todos" },
              { id: "BAG", name: "Mochilas" },
              { id: "CAPE", name: "Capas" }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedType(type.id);
                  if (type.id === "BAG") {
                    setSelectedFaction("ALL"); // Limpiar facción si se elige Mochila
                  }
                }}
                className={`py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                  selectedType === type.id
                    ? "bg-amber-500/10 text-albion-gold border border-albion-gold/30 shadow-[0_0_8px_rgba(198,161,82,0.1)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Tier (Multi-select) */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            3. Tiers Seleccionados
          </label>
          <div className="flex gap-1.5 bg-slate-900 border border-albion-border p-1 rounded-md justify-between">
            {[4, 5, 6, 7, 8].map(tier => {
              const isSelected = selectedTiers.includes(tier);
              return (
                <button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-bold font-mono transition-all duration-200 cursor-pointer text-center border ${
                    isSelected
                      ? "bg-amber-500/10 text-albion-gold border-albion-gold/30 shadow-[0_0_8px_rgba(198,161,82,0.1)]"
                      : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/40"
                  }`}
                >
                  T{tier}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtro de Encantamiento */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            4. Encantamiento
          </label>
          <div className="flex gap-1.5 bg-slate-900 border border-albion-border p-1 rounded-md justify-between">
            {[
              { id: "ALL", name: "Todos" },
              { id: "0", name: ".0" },
              { id: "1", name: ".1" },
              { id: "2", name: ".2" },
              { id: "3", name: ".3" },
              { id: "4", name: ".4" }
            ].map(enc => (
              <button
                key={enc.id}
                onClick={() => setSelectedEnchantment(enc.id)}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold font-mono transition-all duration-200 cursor-pointer text-center ${
                  selectedEnchantment === enc.id
                    ? "bg-amber-500/10 text-albion-gold border border-albion-gold/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                {enc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Facción (Dropdown, solo si Mochila no está seleccionado) */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          <label className={`text-[10px] font-bold uppercase tracking-wider block ${selectedType === 'BAG' ? 'text-slate-600' : 'text-slate-400'}`}>
            5. Facción / Temática {selectedType === 'BAG' && <span className="text-[8px] text-slate-600 lowercase italic">(Inactivo para mochilas)</span>}
          </label>
          <select
            value={selectedFaction}
            disabled={selectedType === 'BAG'}
            onChange={(e) => setSelectedFaction(e.target.value)}
            className={`w-full bg-slate-900 border border-albion-border text-xs px-3 py-2.5 rounded-md outline-none focus:border-albion-gold font-bold ${
              selectedType === 'BAG' ? 'text-slate-600 border-slate-900 cursor-not-allowed opacity-50' : 'text-slate-300 cursor-pointer'
            }`}
          >
            <option value="ALL">Todas las Facciones</option>
            <option value="COMMON">Común (Sin Facción)</option>
            <option value="MARTLOCK">Martlock</option>
            <option value="LYMHURST">Lymhurst</option>
            <option value="FORTSTERLING">Fort Sterling</option>
            <option value="THETFORD">Thetford</option>
            <option value="BRIDGEWATCH">Bridgewatch</option>
            <option value="CAERLEON">Caerleon</option>
            <option value="BRECILIEN">Brecilien</option>
            <option value="HERETIC">Hereje (Heretic)</option>
            <option value="UNDEAD">No Muerto (Undead)</option>
            <option value="KEEPER">Guardián (Keeper)</option>
            <option value="MORGANA">Morgana</option>
            <option value="AVALON">Avaloniana</option>
            <option value="DEMON">Demoníaca</option>
          </select>
        </div>

      </div>

      {/* Resultados de Búsqueda */}
      <div className="flex-1 min-h-[300px] flex flex-col gap-3">
        
        {/* Cabecera del Listado */}
        <div className="flex justify-between items-center px-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          <span>Accesorios Coincidentes</span>
          <span>Mostrando {filteredItems.length} de {parsedItems.length} filtrados</span>
        </div>

        {/* Caja de Grid con Scroll */}
        <div className="flex-1 bg-slate-950/40 border border-albion-border/40 rounded-lg p-4 overflow-y-auto max-h-[360px] min-h-[260px]">
          {filteredItems.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-slate-600 gap-2">
              <span className="text-3xl">🛡️</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ningún ítem coincide</span>
              <p className="text-[10px] text-slate-600 max-w-xs mt-1">Prueba relajando tus filtros o ingresando una palabra clave diferente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => {
                const displayName = getFriendlyName(item);
                const isCape = item.type === "CAPE";
                
                // Color temático de tier
                const tierColors = {
                  4: "border-slate-700/80 bg-slate-900/40 text-slate-300",
                  5: "border-emerald-700/80 bg-emerald-950/15 text-emerald-400",
                  6: "border-blue-700/80 bg-blue-950/15 text-blue-400",
                  7: "border-purple-700/80 bg-purple-950/15 text-purple-400",
                  8: "border-amber-700/80 bg-amber-950/15 text-amber-400"
                }[item.tier] || "border-slate-800 bg-slate-900 text-slate-400";

                return (
                  <div
                    key={item.originalId}
                    className={`border rounded-lg p-3.5 flex flex-col gap-3 justify-between transition-all duration-300 hover:shadow-lg hover:shadow-black/60 group relative overflow-hidden ${tierColors}`}
                  >
                    {/* Badge superior de Encantamiento */}
                    {item.enchantment > 0 && (
                      <span className="absolute top-2.5 right-2.5 text-[8px] font-mono font-bold bg-slate-950/95 border border-albion-gold/30 text-albion-gold px-1.5 py-0.5 rounded leading-none">
                        .{item.enchantment}
                      </span>
                    )}

                    {/* Fila de Imagen e Información */}
                    <div className="flex gap-3.5 items-center">
                      
                      {/* Albion Image Render Container */}
                      <div className="w-14 h-14 bg-slate-950/90 rounded border border-albion-border/80 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner group-hover:border-albion-gold/50 transition-colors">
                        <img
                          src={`https://render.albiononline.com/v1/item/${item.originalId}.png`}
                          className="w-12 h-12 object-contain group-hover:scale-105 transition-transform"
                          alt={displayName}
                          onError={(e) => {
                            // Fallback si la API de render de Albion falla
                            e.target.src = "https://render.albiononline.com/v1/item/T4_CAPE.png";
                          }}
                        />
                      </div>

                      {/* Títulos */}
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-100 group-hover:text-albion-gold transition-colors leading-snug truncate block" title={displayName}>
                          {displayName}
                        </span>
                        
                        <div className="flex gap-1 items-center">
                          <span className="text-[9px] font-mono font-bold px-1 py-0.2 bg-slate-950/80 rounded border border-slate-800 leading-none">
                            T{item.tier}
                          </span>
                          
                          {item.faction && (
                            <span className="text-[8px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-950/40 px-1 rounded truncate max-w-[80px]" title={item.faction}>
                              {item.faction}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Botones de Acción del Item */}
                    <div className="flex gap-1.5 border-t border-slate-800/40 pt-2.5 mt-0.5">
                      
                      {/* Copiar ID */}
                      <button
                        onClick={() => handleCopyId(item.originalId)}
                        className="flex-1 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-albion-border/80 hover:border-slate-500 rounded text-[9px] font-bold uppercase tracking-wider transition cursor-pointer text-slate-400 hover:text-slate-100 flex items-center justify-center gap-1"
                        title="Copiar ID oficial de Albion"
                      >
                        📋 Copiar ID
                      </button>

                      {/* Si se provee callback de selección */}
                      {onSelectItem && (
                        <button
                          onClick={() => onSelectItem(item)}
                          className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-albion-gold border border-albion-gold/40 hover:border-transparent text-albion-gold hover:text-slate-950 font-bold rounded text-[9px] uppercase tracking-wider transition cursor-pointer"
                        >
                          Analizar
                        </button>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Footer / Nota Medieval */}
      <div className="bg-slate-950/30 border border-albion-border/40 rounded p-3 text-[9px] text-slate-500 flex gap-2 items-center">
        <span>🛡️</span>
        <span>
          El parseador utiliza expresiones regulares para analizar cadenas en tiempo de ejecución. Es compatible con todos los tiers (T4-T8) y encantamientos (.0-.4) de mochilas y capas (incluidas las facciones de Caerleon, Brecilien, Lymhurst, etc.) de las APIs oficiales.
        </span>
      </div>

    </div>
  );
}
