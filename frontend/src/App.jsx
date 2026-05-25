import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Mock or Native Pywebview API
const getApi = () => {
  if (window.pywebview && window.pywebview.api) {
    return window.pywebview.api;
  }
  
  // Fallback para pruebas en navegador convencional
  return {
    isMock: true,
    loadDatabase: async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    searchItems: async (categoryId, query) => {
      await new Promise(resolve => setTimeout(resolve, 400));
      const mockDb = {
        "1": [
          "Arco de Badon del iniciado",
          "Arco de Badon del experto",
          "Arco de Badon del maestro",
          "Arco de Badon del gran maestro",
          "Arco de Badon del anciano",
          "Espada del tallador del iniciado",
          "Espada del tallador del experto",
          "Hacha de guerra del iniciado",
          "Maza del iniciado",
          "Martillo de guerra del iniciado",
          "Daga doble del experto",
          "Guanteletes del iniciado"
        ],
        "2": [
          "Armadura de placas del iniciado",
          "Armadura de placas del experto",
          "Chaqueta de mercenario del iniciado",
          "Chaqueta de mercenario del experto",
          "Toga de erudito del iniciado",
          "Toga de erudito del experto"
        ],
        "3": [
          "Casco de soldado del iniciado",
          "Capucha de cazador del iniciado",
          "Hábito de mago del iniciado"
        ],
        "4": [
          "Botas de soldado del iniciado",
          "Sandalias de erudito del iniciado",
          "Zapatos de cuero del iniciado"
        ],
        "5": [
          "Capa del iniciado",
          "Bolsa del iniciado"
        ]
      };
      const items = mockDb[categoryId] || [];
      if (!query.trim()) return items.slice(0, 10);
      return items.filter(item => 
        item.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
    },
    getPrices: async (selectedName, tierChoice, encChoice, server) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Generar precios mock aleatorios para simular
      const cities = ["Caerleon", "Lymhurst", "Martlock", "Bridgewatch", "Fort Sterling", "Thetford", "Brecilien"];
      const basePrice = Math.floor(Math.random() * 400000) + 50000;
      
      const mockPrices = cities.map(city => {
        const factor = 0.8 + Math.random() * 0.4;
        const sell = Math.floor(basePrice * factor);
        const buy = Math.floor(sell * (0.5 + Math.random() * 0.3));
        return {
          city,
          sell_price_min: sell,
          buy_price_max: Math.random() > 0.3 ? buy : 0,
          item_id: `T${tierChoice || 4}_BOW_BADON` + (encChoice && encChoice !== "0" ? `@${encChoice}` : "")
        };
      });

      // Ordenar por precio de venta menor
      mockPrices.sort((a, b) => a.sell_price_min - b.sell_price_min);
      
      const buy_opt = mockPrices[0];
      const sell_opts = mockPrices.filter(x => x.buy_price_max > 0);
      sell_opts.sort((a, b) => b.buy_price_max - a.buy_price_max);
      const sell_opt = sell_opts[0] || null;

      return {
        success: true,
        prices: mockPrices,
        recommendation: {
          buy_city: buy_opt.city,
          buy_price: buy_opt.sell_price_min,
          sell_city: sell_opt ? sell_opt.city : "N/A",
          sell_price: sell_opt ? sell_opt.buy_price_max : 0,
          tier_label: `T${tierChoice || 4}` + (encChoice ? `.${encChoice}` : ".0")
        }
      };
    }
  };
};

function App() {
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  
  const [selectedCategory, setSelectedCategory] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [tier, setTier] = useState("");
  const [enchantment, setEnchantment] = useState("");
  const [server, setServer] = useState("west");
  
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesData, setPricesData] = useState(null);
  const [pricesError, setPricesError] = useState(null);

  const api = useRef(null);

  // Inicializar API y descargar Base de Datos
  useEffect(() => {
    const initApp = async () => {
      // Intentar obtener la API pywebview varias veces en caso de delay en inyección
      let attempts = 0;
      const getApiInstance = () => {
        const instance = getApi();
        if (instance.isMock && attempts < 10 && window.pywebview === undefined) {
          attempts++;
          setTimeout(getApiInstance, 200);
        } else {
          api.current = instance;
          loadDb();
        }
      };
      
      getApiInstance();
    };

    const loadDb = async () => {
      try {
        setDbLoading(true);
        const res = await api.current.loadDatabase();
        if (res.success) {
          setDbLoaded(true);
        } else {
          setDbError(res.error || "Error al descargar la base de datos.");
        }
      } catch (err) {
        setDbError(err.toString());
      } finally {
        setDbLoading(false);
      }
    };

    // Escuchar el evento oficial de pywebview listo
    window.addEventListener('pywebviewready', () => {
      api.current = window.pywebview.api;
      loadDb();
    });

    initApp();
  }, []);

  // Búsqueda en segundo plano al cambiar query o categoría
  useEffect(() => {
    if (!dbLoaded) return;
    
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.current.searchItems(selectedCategory, searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error("Error al buscar items:", err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedCategory, dbLoaded]);

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItem(null);
    setPricesData(null);
  };

  const handleSelectItem = (itemName) => {
    setSelectedItem(itemName);
    setTier("");
    setEnchantment("");
    setPricesData(null);
  };

  const fetchPrices = async () => {
    if (!selectedItem) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const res = await api.current.getPrices(selectedItem, tier, enchantment, server);
      if (res.success) {
        setPricesData(res);
      } else {
        setPricesError(res.error || "No se encontraron variaciones o precios recientes.");
      }
    } catch (err) {
      setPricesError("Error al consultar la API de Albion Online Data.");
      console.error(err);
    } finally {
      setPricesLoading(false);
    }
  };

  // Formatear números a plata (plata)
  const formatSilver = (num) => {
    if (!num) return "0";
    return new Intl.NumberFormat('de-DE').format(num);
  };

  const categories = [
    { id: "1", name: "Armas", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2 6 6-2 2-6-6zm-1-1l-2 2-3-3 3-3 2 2M3 21l3-3m0 0l5-5-3-3-5 5v6h6z" />
      </svg>
    )},
    { id: "2", name: "Armaduras", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )},
    { id: "3", name: "Cascos", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8M9 11h6" />
      </svg>
    )},
    { id: "4", name: "Botas", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14s-3.5-2.5-6-2.5-4 1.5-6 1.5-2-1.5-3-1.5v6c0 1 1.5 1.5 3 1.5s5-1 7-1 3.5 1 4.5 1h.5v-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11.5V3h5l1 3-2 1h-4" />
      </svg>
    )},
    { id: "5", name: "Accesorios", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-albion-dark text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Medieval Header */}
      <header className="border-b border-albion-border/60 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 py-3.5 px-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/10 border border-albion-gold flex items-center justify-center rounded shadow-[0_0_10px_rgba(198,161,82,0.15)]">
            <span className="text-albion-gold font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-albion-gold font-display uppercase">Albion Market</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Analizador de Precios de Escritorio</p>
          </div>
        </div>
        
        {/* Server Selection */}
        <div className="flex items-center gap-2 bg-slate-900 border border-albion-border/80 px-3 py-1.5 rounded-md">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Servidor:</label>
          <select 
            value={server} 
            onChange={(e) => { setServer(e.target.value); setPricesData(null); }}
            className="bg-transparent text-xs text-albion-gold outline-none border-none font-bold cursor-pointer"
          >
            <option value="west" className="bg-slate-900 text-slate-100 font-sans">América (West)</option>
            <option value="east" className="bg-slate-900 text-slate-100 font-sans">Asia (East)</option>
            <option value="europe" className="bg-slate-900 text-slate-100 font-sans">Europa (Europe)</option>
          </select>
        </div>
      </header>

      {/* Database Download Status Block */}
      {dbLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/40">
          <div className="relative w-16 h-16 mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/10"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-albion-gold animate-spin"></div>
          </div>
          <h2 className="text-lg font-bold font-display text-albion-gold tracking-wide">Descargando Base de Datos</h2>
          <p className="text-sm text-slate-400 max-w-sm mt-2">Estamos descargando y preparando el listado completo de items oficiales de Albion Online desde GitHub. Un momento por favor...</p>
        </div>
      )}

      {dbError && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/40">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/50 flex items-center justify-center text-red-400 mb-4 text-xl">✕</div>
          <h2 className="text-lg font-bold text-red-400 font-display">Error de Conexión</h2>
          <p className="text-sm text-slate-400 max-w-md mt-2 mb-4">{dbError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded hover:bg-amber-400 transition"
          >
            Reintentar Conexión
          </button>
        </div>
      )}

      {dbLoaded && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT PANEL: Search and Categories */}
          <section className="lg:col-span-5 border-r border-albion-border/40 bg-slate-950/20 p-5 flex flex-col gap-5 overflow-y-auto">
            
            {/* Category Selector */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2.5">1. Seleccionar Categoría</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-md border text-center transition-all duration-300 group ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500/10 border-albion-gold text-albion-gold shadow-[0_0_15px_rgba(198,161,82,0.1)]'
                        : 'bg-slate-900/50 border-albion-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <div className={`mb-1.5 transition-transform duration-300 group-hover:scale-110 ${selectedCategory === cat.id ? 'text-albion-gold' : 'text-slate-400'}`}>
                      {cat.icon}
                    </div>
                    <span className="text-[10px] font-bold tracking-wide uppercase">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input Box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">2. Buscar Nombre del Ítem</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: Badon, Talla, Hacha..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-albion-border/80 focus:border-albion-gold text-sm text-slate-200 pl-4.5 pr-10 py-3 rounded-md outline-none transition-all placeholder-slate-600 font-medium"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                  {searching ? (
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-albion-gold animate-spin rounded-full"></div>
                  ) : searchQuery ? (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="hover:text-slate-300 text-xs font-semibold focus:outline-none"
                    >
                      ✕
                    </button>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Results Lists */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2.5">3. Selecciona el ítem de la Lista</label>
              <div className="flex-1 bg-slate-950/50 border border-albion-border/30 rounded-md overflow-y-auto max-h-[350px]">
                {searchResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-slate-600 text-center">
                    <svg className="w-8 h-8 mb-2 stroke-slate-700" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs font-semibold">No hay resultados</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">Escribe un nombre arriba para iniciar la búsqueda en la base de datos.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-albion-border/20">
                    {searchResults.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left px-4 py-3 text-xs font-medium transition-all flex items-center justify-between group ${
                          selectedItem === item
                            ? 'bg-amber-500/10 text-albion-gold border-l-2 border-albion-gold'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                        }`}
                      >
                        <span className="truncate pr-2">{item}</span>
                        <svg className={`w-3.5 h-3.5 stroke-slate-500 group-hover:stroke-albion-gold transition-transform group-hover:translate-x-0.5 ${selectedItem === item ? 'stroke-albion-gold' : ''}`} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filters and Search Action */}
            {selectedItem && (
              <div className="bg-slate-950/60 border border-albion-gold/20 p-4 rounded-md flex flex-col gap-4 animate-fadeIn">
                <div className="border-b border-albion-border/40 pb-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Seleccionado:</span>
                  <span className="text-xs font-bold text-albion-gold truncate block mt-0.5">{selectedItem}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">4. Tier (Filtro)</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      className="w-full bg-slate-900 border border-albion-border/60 text-xs text-slate-200 px-3 py-2 rounded-md outline-none focus:border-albion-gold font-semibold"
                    >
                      <option value="">TODOS</option>
                      <option value="1">Tier 1</option>
                      <option value="2">Tier 2</option>
                      <option value="3">Tier 3</option>
                      <option value="4">Tier 4</option>
                      <option value="5">Tier 5</option>
                      <option value="6">Tier 6</option>
                      <option value="7">Tier 7</option>
                      <option value="8">Tier 8</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">5. Encantamiento</label>
                    <select
                      value={enchantment}
                      onChange={(e) => setEnchantment(e.target.value)}
                      className="w-full bg-slate-900 border border-albion-border/60 text-xs text-slate-200 px-3 py-2 rounded-md outline-none focus:border-albion-gold font-semibold"
                    >
                      <option value="">TODOS</option>
                      <option value="0">Normal (.0)</option>
                      <option value="1">Encantado 1 (.1)</option>
                      <option value="2">Encantado 2 (.2)</option>
                      <option value="3">Encantado 3 (.3)</option>
                      <option value="4">Encantado 4 (.4)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={fetchPrices}
                  disabled={pricesLoading}
                  className="w-full py-3 bg-gradient-to-r from-albion-gold to-amber-600 hover:from-albion-gold-hover hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-md shadow-lg shadow-amber-950/20 active:translate-y-px transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {pricesLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent animate-spin rounded-full"></div>
                      Buscando Precios...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Consultar Precios
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* RIGHT PANEL: Results and Pricing Recommendations */}
          <section className="lg:col-span-7 p-6 flex flex-col overflow-y-auto bg-slate-950/10">
            {pricesLoading && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-albion-gold animate-spin mb-4"></div>
                <h3 className="text-sm font-bold text-albion-gold font-display uppercase tracking-wider">Conectando con la API</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">Buscando datos de mercado actualizados en el servidor de Albion Online Data Project...</p>
              </div>
            )}

            {!pricesLoading && !pricesData && !pricesError && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-16 h-16 bg-slate-900 border border-albion-border/40 rounded-full flex items-center justify-center mb-4 text-2xl text-slate-600 shadow-inner">
                  🛒
                </div>
                <h3 className="text-sm font-bold font-display uppercase text-slate-400 tracking-wider">Consola de Precios</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">Busca y selecciona un ítem en el panel de la izquierda para analizar los mejores precios de venta y compra entre ciudades.</p>
              </div>
            )}

            {pricesError && !pricesLoading && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-950/30 border border-red-500/40 text-red-400 flex items-center justify-center text-lg mb-3">✕</div>
                <h3 className="text-sm font-bold text-red-400 font-display">Sin Resultados</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">{pricesError}</p>
              </div>
            )}

            {pricesData && !pricesLoading && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                
                {/* Header for pricing table */}
                <div className="border-b border-albion-border/60 pb-3 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">Análisis de Mercado</span>
                    <h2 className="text-lg font-bold text-slate-100 mt-0.5 font-display tracking-wide">{selectedItem}</h2>
                  </div>
                  <span className="bg-amber-500/10 text-albion-gold border border-albion-gold/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                    {pricesData.recommendation?.tier_label || "Filtro"}
                  </span>
                </div>

                {/* Recommendations Banner (Buy/Sell) */}
                {pricesData.recommendation && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Buy Recommendation Card */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-albion-gold/30 rounded-lg p-4 shadow-md flex items-start gap-3.5 relative overflow-hidden group">
                      <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors"></div>
                      <div className="w-10 h-10 rounded-md bg-amber-500/10 border border-albion-gold/30 flex items-center justify-center text-albion-gold text-lg shrink-0">
                        🛒
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Mejor Lugar Para Comprar</span>
                        <span className="text-lg font-bold text-amber-100 font-display block mt-1 truncate">{pricesData.recommendation.buy_city}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-semibold text-slate-400">Precio Venta Mín:</span>
                          <span className="text-sm font-bold text-amber-400 font-mono">{formatSilver(pricesData.recommendation.buy_price)} <span className="text-[10px] font-normal text-amber-500/80">plata</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Sell Recommendation Card */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-albion-border/60 rounded-lg p-4 shadow-md flex items-start gap-3.5 relative overflow-hidden group">
                      <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
                      <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shrink-0">
                        💰
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Mejor Lugar Para Vender</span>
                        {pricesData.recommendation.sell_city !== "N/A" ? (
                          <>
                            <span className="text-lg font-bold text-emerald-100 font-display block mt-1 truncate">{pricesData.recommendation.sell_city}</span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs font-semibold text-slate-400">Orden Compra Máx:</span>
                              <span className="text-sm font-bold text-emerald-400 font-mono">{formatSilver(pricesData.recommendation.sell_price)} <span className="text-[10px] font-normal text-emerald-500/80">plata</span></span>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-slate-500 block mt-2.5 italic">Sin Órdenes de Compra</span>
                            <span className="text-[10px] text-slate-600 block mt-0.5">No hay órdenes registradas</span>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* Pricing Table Detail */}
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Detalle de Precios por Ciudad</h3>
                  <div className="bg-slate-900/60 border border-albion-border/40 rounded-lg overflow-hidden shadow-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-albion-border/50 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            <th className="py-3 px-4">Ciudad</th>
                            <th className="py-3 px-4 text-right">Precio Venta Mín (Comprar)</th>
                            <th className="py-3 px-4 text-right">Precio Compra Máx (Vender)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-albion-border/20 text-xs font-medium">
                          {pricesData.prices.map((p, i) => {
                            const isCheapestBuy = p.city === pricesData.recommendation.buy_city && p.sell_price_min === pricesData.recommendation.buy_price;
                            const isBestSell = pricesData.recommendation.sell_city !== "N/A" && p.city === pricesData.recommendation.sell_city && p.buy_price_max === pricesData.recommendation.sell_price;
                            
                            return (
                              <tr 
                                key={i} 
                                className={`transition-colors duration-150 hover:bg-slate-950/40 ${
                                  isCheapestBuy ? 'bg-amber-950/20' : isBestSell ? 'bg-emerald-950/20' : ''
                                }`}
                              >
                                <td className="py-3.5 px-4 font-bold flex items-center gap-2">
                                  <span className="text-slate-100">{p.city}</span>
                                  {isCheapestBuy && (
                                    <span className="bg-amber-500/20 text-[9px] text-albion-gold font-bold px-1.5 py-0.5 rounded border border-albion-gold/30 uppercase scale-90">Barato</span>
                                  )}
                                  {isBestSell && (
                                    <span className="bg-emerald-500/20 text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase scale-90">Mejor Venta</span>
                                  )}
                                </td>
                                <td className={`py-3.5 px-4 text-right font-mono text-slate-300 ${isCheapestBuy ? 'text-amber-400 font-bold' : ''}`}>
                                  {p.sell_price_min > 0 ? `${formatSilver(p.sell_price_min)}` : 'N/D'}
                                </td>
                                <td className={`py-3.5 px-4 text-right font-mono text-slate-400 ${isBestSell ? 'text-emerald-400 font-bold' : ''}`}>
                                  {p.buy_price_max > 0 ? `${formatSilver(p.buy_price_max)}` : '0'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/30 border border-albion-border/20 rounded p-3 text-[10px] text-slate-500 flex gap-2 items-center">
                  <span>ℹ</span>
                  <span>Los datos de precios son recuperados directamente de las bases de datos descentralizadas de <strong>Albion Online Data Project</strong>. Es posible que existan discrepancias temporales con el mercado en tiempo real dentro del juego.</span>
                </div>

              </div>
            )}
          </section>
        </main>
      )}

      {/* Marca de agua flotante en el borde */}
      <a 
        href="https://github.com/Srflowthers" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-12 right-6 z-50 bg-slate-950/80 backdrop-blur-md border border-albion-border/60 hover:border-albion-gold/60 text-slate-500 hover:text-albion-gold text-[9px] font-bold py-1.5 px-3 rounded shadow-lg shadow-black/40 transition-all duration-300 opacity-40 hover:opacity-100 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5 fill-currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span>Creado por Flowthers</span>
      </a>

      {/* Footer */}
      <footer className="py-3 px-6 border-t border-albion-border/30 bg-slate-950/50 flex justify-between items-center text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span>Albion Market GUI v1.0.0</span>
          <span className="text-slate-700">|</span>
          <span>Creado por <a href="https://github.com/Srflowthers" target="_blank" rel="noopener noreferrer" className="text-albion-gold hover:underline font-semibold">Srflowthers</a></span>
        </div>
        <div>
          Conectado con <a href="https://www.albion-online-data.com/" target="_blank" className="text-albion-gold hover:underline">Albion Online Data Project</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
