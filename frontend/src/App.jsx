import React, { useState, useEffect, useRef } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import html2canvas from 'html2canvas';
import './App.css';

const QUALITY_NAMES = {
  1: "Normal",
  2: "Bueno",
  3: "Sobresaliente",
  4: "Excelente",
  5: "Obra Maestra"
};

const MATERIALS_LIST = {
  raw: [
    { id: "FIBER", name: "Fibra", icon: "🌾", previewId: "T4_FIBER" },
    { id: "HIDE", name: "Piel", icon: "🐆", previewId: "T4_HIDE" },
    { id: "ORE", name: "Mineral", icon: "🪨", previewId: "T4_ORE" },
    { id: "WOOD", name: "Madera", icon: "🪵", previewId: "T4_WOOD" },
    { id: "ROCK", name: "Piedra", icon: "🧱", previewId: "T4_ROCK" }
  ],
  refined: [
    { id: "CLOTH", name: "Tela", icon: "🧵", previewId: "T4_CLOTH" },
    { id: "LEATHER", name: "Cuero", icon: "🧥", previewId: "T4_LEATHER" },
    { id: "METALBAR", name: "Metal", icon: "🪙", previewId: "T4_METALBAR" },
    { id: "PLANKS", name: "Tablas", icon: "🛷", previewId: "T4_PLANKS" },
    { id: "STONEBLOCK", name: "Bloques", icon: "🕋", previewId: "T4_STONEBLOCK" }
  ]
};

const foodMap = [
  { name: "guiso", id: "MEAL_STEW" },
  { name: "sopa", id: "MEAL_SOUP" },
  { name: "ensalada", id: "MEAL_SALAD" },
  { name: "omelette", id: "MEAL_OMELETTE" },
  { name: "sandwich", id: "MEAL_SANDWICH" },
  { name: "pie", id: "MEAL_PIE" }
];

const foodIcons = {
  "MEAL_STEW": "🍲",
  "MEAL_SOUP": "🍜",
  "MEAL_SALAD": "🥗",
  "MEAL_OMELETTE": "🍳",
  "MEAL_SANDWICH": "🥪",
  "MEAL_PIE": "🥧"
};

const foodPreviewIds = {
  "MEAL_STEW": "T8_MEAL_STEW",
  "MEAL_SOUP": "T7_MEAL_SOUP",
  "MEAL_SALAD": "T6_MEAL_SALAD",
  "MEAL_OMELETTE": "T7_MEAL_OMELETTE",
  "MEAL_SANDWICH": "T8_MEAL_SANDWICH",
  "MEAL_PIE": "T7_MEAL_PIE"
};

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
        ],
        "8": [
          "Runa del iniciado",
          "Runa del experto",
          "Runa del maestro",
          "Alma del iniciado",
          "Alma del experto",
          "Alma del maestro",
          "Reliquia del iniciado",
          "Reliquia del experto",
          "Reliquia del maestro"
        ]
      };
      const items = mockDb[categoryId] || [];
      const idMap = {
        "1": "T4_2H_BOW_BADON",
        "2": "T4_ARMOR_PLATE_SET1",
        "3": "T4_HEAD_PLATE_SET1",
        "4": "T4_SHOES_PLATE_SET1",
        "5": "T4_CAPE",
        "8": "T4_RUNE"
      };
      
      const filtered = query.trim()
        ? items.filter(item => item.toLowerCase().includes(query.toLowerCase()))
        : items;
        
      return filtered.slice(0, 10).map(item => {
        let itemId = idMap[categoryId] || "T4_CAPE";
        if (categoryId === "8") {
          if (item.includes("Runa")) itemId = "T4_RUNE";
          else if (item.includes("Alma")) itemId = "T4_SOUL";
          else if (item.includes("Reliquia")) itemId = "T4_RELIC";
        }
        return {
          display_name: item.includes(" del ") ? item.split(" del ")[0] : item,
          id: itemId
        };
      });
    },
    getPrices: async (selectedName, tierChoice, encChoice, qualityChoice, server) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Generar precios mock aleatorios para simular
      const cities = ["Caerleon", "Lymhurst", "Martlock", "Bridgewatch", "Fort Sterling", "Thetford", "Brecilien"];
      const basePrice = Math.floor(Math.random() * 400000) + 50000;
      
      const mockPrices = cities.map(city => {
        const factor = 0.8 + Math.random() * 0.4;
        const sell = Math.floor(basePrice * factor);
        const buy = Math.floor(sell * (0.5 + Math.random() * 0.3));
        const item_id = `T${tierChoice || 4}_BOW_BADON` + (encChoice && encChoice !== "0" ? `@${encChoice}` : "");
        return {
          city,
          sell_price_min: sell,
          buy_price_max: Math.random() > 0.3 ? buy : 0,
          item_id,
          quality: qualityChoice ? parseInt(qualityChoice) : 1,
          name: selectedName,
          tier: tierChoice || "4",
          enchantment: encChoice || "0"
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
          tier_label: `T${tierChoice || 4}` + (encChoice ? `.${encChoice}` : ".0"),
          quality: qualityChoice ? parseInt(qualityChoice) : 1
        }
      };
    },
    getItemTiers: async (itemName) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (["HIDE", "FIBER", "ORE", "WOOD", "ROCK", "CLOTH", "LEATHER", "METALBAR", "PLANKS", "STONEBLOCK", "MEAL_STEW", "MEAL_SOUP", "MEAL_SALAD", "MEAL_OMELETTE", "MEAL_SANDWICH", "MEAL_PIE"].includes(itemName)) {
        const namesMap = {
          "HIDE": ["Retales de piel", "Piel tosca", "Piel fina", "Piel mediana", "Piel pesada", "Piel robusta", "Piel gruesa", "Piel resistente"],
          "FIBER": ["Fibra de cáñamo", "Algodón", "Lino", "Cáñamo", "Cielo", "Fibra celestial", "Fibra de leyenda", "Fibra primordial"],
          "ORE": ["Mineral", "Hierro", "Titanio", "Runa", "Meteorito", "Adamantio", "Oricalco", "Mitrilo"],
          "WOOD": ["Madera", "Pino", "Rojo", "Blanco", "Mágico", "Antiguo", "Eldwood", "Legendaria"],
          "ROCK": ["Roca", "Piedra", "Mármol", "Granito", "Pizarra", "Travertino", "Basalto", "Obsidiana"],
          "CLOTH": ["Tela", "Lino", "Seda", "Cielo", "Satén", "Terciopelo", "Brocado", "Encaje"],
          "LEATHER": ["Cuero", "Piel tosca", "Piel fina", "Cuero mediano", "Cuero pesado", "Cuero robusto", "Cuero grueso", "Cuero resistente"],
          "METALBAR": ["Metal", "Hierro", "Titanio", "Runa", "Meteorito", "Adamantio", "Oricalco", "Mitrilo"],
          "PLANKS": ["Madera", "Pino", "Rojo", "Blanco", "Mágico", "Antiguo", "Eldwood", "Legendaria"],
          "STONEBLOCK": ["Roca", "Piedra", "Mármol", "Granito", "Pizarra", "Travertino", "Basalto", "Obsidiana"],
          "MEAL_STEW": ["", "", "", "Guiso de iniciado", "", "Guiso de maestro", "", "Guiso de anciano"],
          "MEAL_SOUP": ["", "", "Sopa de trigo", "", "Sopa de col", "", "Sopa de cordero", ""],
          "MEAL_SALAD": ["", "", "", "Ensalada de iniciado", "", "Ensalada de maestro", "", "Ensalada de anciano"],
          "MEAL_OMELETTE": ["", "", "Tortilla de trigo", "", "Tortilla de col", "", "Tortilla de cordero", ""],
          "MEAL_SANDWICH": ["", "", "", "Bocadillo de iniciado", "", "Bocadillo de maestro", "", "Bocadillo de anciano"],
          "MEAL_PIE": ["", "", "Pastel de trigo", "", "Pastel de col", "", "Pastel de cordero", ""]
        };
        const names = namesMap[itemName] || [];
        return [1, 2, 3, 4, 5, 6, 7, 8].map(t => ({
          tier: t.toString(),
          id: `T${t}_${itemName}`,
          name: names[t - 1] || `${itemName} T${t}`
        })).filter(x => x.name !== "");
      }
      if (["Runa", "Alma", "Reliquia"].includes(itemName)) {
        const idSuffix = itemName === "Runa" ? "RUNE" : itemName === "Alma" ? "SOUL" : "RELIC";
        return [
          { tier: "4", id: `T4_${idSuffix}`, name: `${itemName} del iniciado` },
          { tier: "5", id: `T5_${idSuffix}`, name: `${itemName} del experto` },
          { tier: "6", id: `T6_${idSuffix}`, name: `${itemName} del maestro` }
        ];
      }
      return [
        { tier: "4", id: "T4_CAPE", name: "Capa de iniciado" },
        { tier: "5", id: "T5_CAPE", name: "Capa de experto" }
      ];
    },
    getRiskRadar: async (server) => {
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockZones = [
        {
          name: "Redtree Enclave",
          type: "Black Zone",
          death_count: 8,
          avg_group_size: 4.5,
          avg_killer_ip: 1420.5,
          risk_level: "red",
          survival_gathering: 35,
          survival_farming: 30,
          survival_transport: 25,
          deaths: [
            {
              event_id: 1234567,
              victim_name: "GankerHunter99",
              victim_guild: "Arch",
              victim_alliance: "ARCH",
              victim_ip: 1100.0,
              killer_name: "PvPMaster",
              killer_guild: "Dune",
              killer_alliance: "DUNE",
              killer_ip: 1450.0,
              group_size: 3,
              fame: 15400,
              timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
              inventory: [{ name: "T8_FIBER", count: 40, quality: 1 }],
              equipment: [{ slot: "MainHand", name: "Doble Daga del Experto", count: 1, quality: 3 }]
            }
          ]
        },
        {
          name: "Creag Garr",
          type: "Red Zone",
          death_count: 4,
          avg_group_size: 2.1,
          avg_killer_ip: 1150.0,
          risk_level: "orange",
          survival_gathering: 65,
          survival_farming: 60,
          survival_transport: 55,
          deaths: [
            {
              event_id: 1234568,
              victim_name: "TraderJoe",
              victim_guild: "Mercenarios",
              victim_alliance: "",
              victim_ip: 850.0,
              killer_name: "RedPlayer",
              killer_guild: "PKs",
              killer_alliance: "",
              killer_ip: 1200.0,
              group_size: 2,
              fame: 4500,
              timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
              inventory: [],
              equipment: []
            }
          ]
        },
        {
          name: "Lymhurst Portal Area",
          type: "Black Zone",
          death_count: 1,
          avg_group_size: 1.0,
          avg_killer_ip: 1050.0,
          risk_level: "yellow",
          survival_gathering: 85,
          survival_farming: 88,
          survival_transport: 80,
          deaths: [
            {
              event_id: 1234569,
              victim_name: "GathererPro",
              victim_guild: "Woodcutters",
              victim_alliance: "",
              victim_ip: 1000.0,
              killer_name: "SoloGanker",
              killer_guild: "LoneWolves",
              killer_alliance: "",
              killer_ip: 1100.0,
              group_size: 1,
              fame: 2000,
              timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
              inventory: [],
              equipment: []
            }
          ]
        },
        {
          name: "Bridgewatch Portal Area",
          type: "Black Zone",
          death_count: 0,
          avg_group_size: 0,
          avg_killer_ip: 0,
          risk_level: "green",
          survival_gathering: 98,
          survival_farming: 99,
          survival_transport: 96,
          deaths: []
        }
      ];
      return {
        success: true,
        zones: mockZones,
        total_kills: 13
      };
    }
  };
};

function App() {
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  
  const [selectedMainTab, setSelectedMainTab] = useState("equipamiento");
  const [selectedCategory, setSelectedCategory] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTiers, setItemTiers] = useState([]);
  const [materialsRefinedFilter, setMaterialsRefinedFilter] = useState(false);
  
  const [tier, setTier] = useState("");
  const [enchantment, setEnchantment] = useState("");
  const [quality, setQuality] = useState("");
  const [server, setServer] = useState("west");
  
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesData, setPricesData] = useState(null);
  const [pricesError, setPricesError] = useState(null);

  // Estados del Risk Radar PvP
  const [activeTab, setActiveTab] = useState("market"); // "market" o "radar"
  const [radarData, setRadarData] = useState(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedDeath, setSelectedDeath] = useState(null);
  const [radarSearchQuery, setRadarSearchQuery] = useState("");
  const [radarFilterType, setRadarFilterType] = useState("All"); // "All", "Red Zone", "Black Zone"
  const [radarFilterRisk, setRadarFilterRisk] = useState("All"); // "All", "red", "orange", "yellow", "green"
  const [lastRadarUpdate, setLastRadarUpdate] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(45);

  const [deathItemImages, setDeathItemImages] = useState({});
  const [loadingDeathImages, setLoadingDeathImages] = useState(false);

  const api = useRef(null);

  // Cargar imágenes en base64 para evitar taint en el canvas (CORS) en el modal de muertes
  useEffect(() => {
    if (!selectedDeath) {
      setDeathItemImages({});
      setLoadingDeathImages(false);
      return;
    }

    const loadImages = async () => {
      setLoadingDeathImages(true);
      const uniqueIds = new Set();
      
      if (selectedDeath.equipment) {
        selectedDeath.equipment.forEach(item => {
          if (item && item.id) uniqueIds.add(item.id);
        });
      }
      if (selectedDeath.inventory) {
        selectedDeath.inventory.forEach(item => {
          if (item && item.id) uniqueIds.add(item.id);
        });
      }

      const imagesMap = {};
      const promises = Array.from(uniqueIds).map(async (itemId) => {
        try {
          if (api.current && !api.current.isMock && api.current.getItemImageBase64) {
            const res = await api.current.getItemImageBase64(itemId);
            if (res && res.success && res.base64) {
              imagesMap[itemId] = res.base64;
              return;
            }
          }
        } catch (err) {
          console.error("Error loading base64 image for item:", itemId, err);
        }
        // Fallback
        imagesMap[itemId] = `https://render.albiononline.com/v1/item/${itemId}.png`;
      });

      await Promise.all(promises);
      setDeathItemImages(imagesMap);
      setLoadingDeathImages(false);
    };

    loadImages();
  }, [selectedDeath]);

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
    setItemTiers([]);
    setTier("");
    setEnchantment("");
    setQuality("");
  };

  const handleSelectItem = async (itemName) => {
    setSelectedItem(itemName);
    setTier("");
    setEnchantment("");
    setQuality("");
    setPricesData(null);
    setItemTiers([]);
    
    if (itemName) {
      try {
        const tiers = await api.current.getItemTiers(itemName);
        setItemTiers(tiers || []);
      } catch (err) {
        console.error("Error al obtener tiers:", err);
      }
    }
  };

  const handleSelectMainTab = (tab) => {
    setSelectedMainTab(tab);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItem(null);
    setPricesData(null);
    setItemTiers([]);
    setTier("");
    setEnchantment("");
    setQuality("");
    
    if (tab === "equipamiento") {
      setSelectedCategory("1");
    } else if (tab === "consumibles") {
      setSelectedCategory("71");
    } else if (tab === "materiales") {
      setSelectedCategory("6");
    } else if (tab === "artefactos") {
      setSelectedCategory("8");
    }
  };

  const getSelectedDisplayName = (item) => {
    if (!item) return "";
    const materialsNames = {
      "FIBER": "Fibra (Sin Refinar)",
      "HIDE": "Piel (Sin Refinar)",
      "ORE": "Mineral (Sin Refinar)",
      "WOOD": "Madera (Sin Refinar)",
      "ROCK": "Piedra (Sin Refinar)",
      "CLOTH": "Tela (Refinada)",
      "LEATHER": "Cuero (Refinado)",
      "METALBAR": "Metal (Refinado)",
      "PLANKS": "Tablas (Refinada)",
      "STONEBLOCK": "Bloques (Refinado)",
      "MEAL_STEW": "Guiso",
      "MEAL_SOUP": "Sopa",
      "MEAL_SALAD": "Ensalada",
      "MEAL_OMELETTE": "Omelette",
      "MEAL_SANDWICH": "Sándwich",
      "MEAL_PIE": "Pastel (Pie)"
    };
    return materialsNames[item] || item;
  };

  const fetchPrices = async () => {
    if (!selectedItem) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const res = await api.current.getPrices(selectedItem, tier, enchantment, quality, server);
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

  const fetchRadar = async (showLoading = true) => {
    if (!api.current) return;
    if (showLoading) setRadarLoading(true);
    setRadarError(null);
    try {
      const res = await api.current.getRiskRadar(server);
      if (res.success) {
        setRadarData(res);
        setLastRadarUpdate(new Date());
        
        setSelectedZone(current => {
          if (current) {
            const updated = res.zones.find(z => z.name === current.name);
            return updated || res.zones[0] || null;
          }
          return res.zones[0] || null;
        });
      } else {
        setRadarError(res.error || "Error al obtener los datos del Radar.");
      }
    } catch (err) {
      setRadarError("Error de conexión al obtener los eventos de PvP.");
      console.error(err);
    } finally {
      if (showLoading) setRadarLoading(false);
    }
  };

  // Cargar datos al cambiar de pestaña, de servidor o base de datos lista
  useEffect(() => {
    if (activeTab === "radar" && dbLoaded) {
      fetchRadar(true);
      setRefreshCountdown(45);
    }
  }, [activeTab, server, dbLoaded]);

  // Manejar la cuenta regresiva e invocar recarga silenciosa
  useEffect(() => {
    if (activeTab !== "radar" || !dbLoaded) return;

    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          fetchRadar(false);
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, server, dbLoaded]);

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
    )},
    { id: "6", name: "Materiales", icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-950 border border-albion-border/60 p-1 rounded-md">
          <button
            onClick={() => setActiveTab("market")}
            className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition duration-200 cursor-pointer ${
              activeTab === "market"
                ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.1)]"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Mercado
          </button>
          <button
            onClick={() => setActiveTab("radar")}
            className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition duration-200 cursor-pointer flex items-center gap-2 ${
              activeTab === "radar"
                ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.1)]"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Radar PvP
          </button>
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

      {dbLoaded && activeTab === "market" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT PANEL: Search and Categories */}
          <section className="lg:col-span-5 border-r border-albion-border/40 bg-slate-950/20 p-5 flex flex-col gap-5 lg:overflow-hidden overflow-y-auto relative">
            
            {/* Main Category Tabs */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2.5">1. Categoría Principal</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950/80 border border-albion-border/60 p-1.5 rounded-lg shadow-inner">
                <button
                  onClick={() => handleSelectMainTab("equipamiento")}
                  className={`py-2 px-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex flex-col items-center gap-1.5 ${
                    selectedMainTab === "equipamiento"
                      ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.15)]"
                      : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  <span className="text-base">🛡️</span>
                  <span className="text-[9px] sm:text-[10px]">Equipamiento</span>
                </button>
                <button
                  onClick={() => handleSelectMainTab("consumibles")}
                  className={`py-2 px-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex flex-col items-center gap-1.5 ${
                    selectedMainTab === "consumibles"
                      ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.15)]"
                      : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  <span className="text-base">🧪</span>
                  <span className="text-[9px] sm:text-[10px]">Consumibles</span>
                </button>
                <button
                  onClick={() => handleSelectMainTab("materiales")}
                  className={`py-2 px-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex flex-col items-center gap-1.5 ${
                    selectedMainTab === "materiales"
                      ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.15)]"
                      : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  <span className="text-base">🪵</span>
                  <span className="text-[9px] sm:text-[10px]">Materiales</span>
                </button>
                <button
                  onClick={() => handleSelectMainTab("artefactos")}
                  className={`py-2 px-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex flex-col items-center gap-1.5 ${
                    selectedMainTab === "artefactos"
                      ? "bg-amber-500/10 text-albion-gold border border-albion-gold/40 shadow-[0_0_10px_rgba(198,161,82,0.15)]"
                      : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  <span className="text-base">🔮</span>
                  <span className="text-[9px] sm:text-[10px]">Artefactos</span>
                </button>
              </div>
            </div>

            {/* Sub-Category Selector (only shown for Equipamiento) */}
            {selectedMainTab === "equipamiento" && (
              <div className="animate-fadeIn">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">2. Tipo de Equipamiento</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {categories.slice(0, 5).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all duration-300 group cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-amber-500/10 border-albion-gold text-albion-gold shadow-[0_0_10px_rgba(198,161,82,0.15)]'
                          : 'bg-slate-900/50 border-albion-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      <div className={`mb-1 transition-transform duration-300 group-hover:scale-110 ${selectedCategory === cat.id ? 'text-albion-gold' : 'text-slate-400'}`}>
                        {cat.icon}
                      </div>
                      <span className="text-[8px] font-bold tracking-wide uppercase truncate w-full">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Category Selector (only shown for Consumibles) */}
            {selectedMainTab === "consumibles" && (
              <div className="animate-fadeIn flex flex-col gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">2. Tipo de Consumible</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "71", name: "Comida", icon: "🍖" },
                      { id: "72", name: "Pociones", icon: "🧪" },
                      { id: "73", name: "Tomos", icon: "📚" },
                      { id: "74", name: "Otros", icon: "🗺️" }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all duration-300 group ${
                          selectedCategory === cat.id
                            ? 'bg-amber-500/10 border-albion-gold text-albion-gold shadow-[0_0_10px_rgba(198,161,82,0.15)]'
                            : 'bg-slate-900/50 border-albion-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-base mb-1 transition-transform duration-300 group-hover:scale-110">
                          {cat.icon}
                        </div>
                        <span className="text-[8px] font-bold tracking-wide uppercase truncate w-full">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Static Food Grid (only shown when selectedCategory is Comida "71") */}
                {selectedCategory === "71" && (
                  <div className="flex flex-col gap-2 animate-fadeIn">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">3. Seleccionar Comida</label>
                    <div className="grid grid-cols-3 gap-2">
                      {foodMap.map(food => {
                        const isSelected = selectedItem === food.id;
                        const previewId = foodPreviewIds[food.id] || `T7_${food.id}`;
                        const displayName = getSelectedDisplayName(food.id);
                        return (
                          <button
                            key={food.id}
                            onClick={() => handleSelectItem(food.id)}
                            className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all duration-300 group cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 border-albion-gold text-albion-gold shadow-[0_0_12px_rgba(198,161,82,0.15)]'
                                : 'bg-slate-900/50 border-albion-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            <div className="w-10 h-10 rounded bg-slate-950/60 border border-albion-border/30 flex items-center justify-center overflow-hidden mb-1 group-hover:scale-105 transition-transform shrink-0">
                              <LazyLoadImage
                                src={`https://render.albiononline.com/v1/item/${previewId}.png`}
                                effect="blur"
                                className="w-9 h-9 object-contain"
                                alt={displayName}
                              />
                            </div>
                            <span className="text-[9px] font-bold tracking-wide uppercase truncate w-full">{displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Materials Toggles and Grid (only shown for Materiales) */}
            {selectedMainTab === "materiales" && (
              <div className="flex flex-col gap-4 animate-fadeIn">
                {/* Raw vs Refined Toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">2. Tipo de Recurso</label>
                  <div className="flex bg-slate-950/80 border border-albion-border/60 p-1 rounded-md">
                    <button
                      onClick={() => { setMaterialsRefinedFilter(false); handleSelectItem(null); }}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                        !materialsRefinedFilter
                          ? "bg-amber-500/10 text-albion-gold border border-albion-gold/30"
                          : "text-slate-400 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      Sin Refinar (Crudo)
                    </button>
                    <button
                      onClick={() => { setMaterialsRefinedFilter(true); handleSelectItem(null); }}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                        materialsRefinedFilter
                          ? "bg-amber-500/10 text-albion-gold border border-albion-gold/30"
                          : "text-slate-400 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      Refinados
                    </button>
                  </div>
                </div>

                {/* Materials Grid */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">3. Seleccionar Material</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(materialsRefinedFilter ? MATERIALS_LIST.refined : MATERIALS_LIST.raw).map(mat => {
                      const isSelected = selectedItem === mat.id;
                      return (
                        <button
                          key={mat.id}
                          onClick={() => handleSelectItem(mat.id)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all duration-300 group cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/10 border-albion-gold text-albion-gold shadow-[0_0_12px_rgba(198,161,82,0.15)]'
                              : 'bg-slate-900/50 border-albion-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          <div className="w-10 h-10 rounded bg-slate-950/60 border border-albion-border/30 flex items-center justify-center overflow-hidden mb-1 group-hover:scale-105 transition-transform shrink-0">
                            <LazyLoadImage
                              src={`https://render.albiononline.com/v1/item/${mat.previewId}.png`}
                              effect="blur"
                              className="w-9 h-9 object-contain"
                              alt={mat.name}
                            />
                          </div>
                          <span className="text-[9px] font-bold tracking-wide uppercase truncate w-full">{mat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Search Input Box (only shown for Equipamiento and Consumibles except Comida) */}
            {selectedMainTab !== "materiales" && selectedCategory !== "71" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {selectedMainTab === "artefactos" ? "2. Buscar Nombre del Artefacto" : "2. Buscar Nombre del Ítem"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedMainTab === "artefactos" ? "Ej: Runa, Alma, Reliquia..." : "Ej: Badon, Talla, Guante..."}
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
            )}

            {/* Filters and Search Action - Static/Sticky below selection */}
            {selectedItem && (
              <div className="bg-slate-950/95 border border-albion-gold/30 p-4 rounded-md flex flex-col gap-4 animate-fadeIn sticky top-0 z-10 shadow-xl backdrop-blur-md">
                <div className="border-b border-albion-border/40 pb-2 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Seleccionado:</span>
                    <span className="text-xs font-bold text-albion-gold truncate block mt-0.5 max-w-[200px]" title={selectedItem}>
                      {getSelectedDisplayName(selectedItem)}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleSelectItem(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs font-bold p-1 cursor-pointer"
                    title="Desmarcar"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">Tier (Filtro)</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      className="w-full bg-slate-900 border border-albion-border/60 text-xs text-slate-200 px-3 py-2 rounded-md outline-none focus:border-albion-gold font-semibold"
                    >
                      <option value="">TODOS</option>
                      {itemTiers && itemTiers.length > 0 ? (
                        itemTiers.map(t => (
                          <option key={t.tier} value={t.tier}>{t.name} (T{t.tier})</option>
                        ))
                      ) : (
                        <>
                          <option value="1">Tier 1</option>
                          <option value="2">Tier 2</option>
                          <option value="3">Tier 3</option>
                          <option value="4">Tier 4</option>
                          <option value="5">Tier 5</option>
                          <option value="6">Tier 6</option>
                          <option value="7">Tier 7</option>
                          <option value="8">Tier 8</option>
                        </>
                      )}
                    </select>
                  </div>

                {selectedCategory !== "8" && !selectedCategory.startsWith("7") && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">Encantamiento</label>
                    <select
                      value={enchantment}
                      onChange={(e) => setEnchantment(e.target.value)}
                      className="w-full bg-slate-900 border border-albion-border/60 text-xs text-slate-200 px-3 py-2 rounded-md outline-none focus:border-albion-gold font-semibold"
                    >
                      <option value="">TODOS</option>
                      <option value="0">Normal</option>
                      <option value="1">Encantamiento 1</option>
                      <option value="2">Encantamiento 2</option>
                      <option value="3">Encantamiento 3</option>
                      <option value="4">Encantamiento 4</option>
                    </select>
                  </div>
                )}
                </div>

                {selectedCategory !== "6" && selectedCategory !== "8" && !selectedCategory.startsWith("7") && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">Calidad</label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-full bg-slate-900 border border-albion-border/60 text-xs text-slate-200 px-3 py-2 rounded-md outline-none focus:border-albion-gold font-semibold"
                    >
                      <option value="">TODOS</option>
                      <option value="1">Normal</option>
                      <option value="2">Bueno (Good)</option>
                      <option value="3">Sobresaliente (Outstanding)</option>
                      <option value="4">Excelente (Excellent)</option>
                      <option value="5">Obra Maestra (Masterpiece)</option>
                    </select>
                  </div>
                )}

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

            {/* Results Lists (only shown for Equipamiento and Consumibles except Comida) */}
            {selectedMainTab !== "materiales" && selectedCategory !== "71" && (
              <div className="flex-1 flex flex-col min-h-[220px]">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2.5">
                  {selectedMainTab === "artefactos" ? "3. Selecciona el artefacto de la Lista" : "3. Selecciona el ítem de la Lista"}
                </label>
                <div className="flex-1 bg-slate-950/50 border border-albion-border/30 rounded-md overflow-y-auto lg:max-h-[250px] max-h-[350px]">
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
                      {searchResults.map((item, index) => {
                        const isSelected = selectedItem === item.display_name;
                        return (
                          <button
                            key={index}
                            onClick={() => handleSelectItem(item.display_name)}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 text-albion-gold border-l-2 border-albion-gold'
                                : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded bg-slate-950/60 border border-albion-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                                <LazyLoadImage
                                  src={`https://render.albiononline.com/v1/item/${item.id}.png`}
                                  effect="blur"
                                  className="w-7 h-7 object-contain"
                                  alt={item.display_name}
                                />
                              </div>
                              <span className="truncate pr-2">{item.display_name}</span>
                            </div>
                            <svg className={`w-3.5 h-3.5 stroke-slate-500 group-hover:stroke-albion-gold transition-transform group-hover:translate-x-0.5 ${isSelected ? 'stroke-albion-gold' : ''}`} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                    <h2 className="text-lg font-bold text-slate-100 mt-0.5 font-display tracking-wide">{getSelectedDisplayName(selectedItem)}</h2>
                  </div>
                  <span className="bg-amber-500/10 text-albion-gold border border-albion-gold/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono flex items-center gap-1.5">
                    <span>{pricesData.recommendation?.tier_label || "Filtro"}</span>
                    {pricesData.recommendation?.quality && (
                      <>
                        <span className="text-slate-600">|</span>
                        <span>{QUALITY_NAMES[pricesData.recommendation.quality]}</span>
                      </>
                    )}
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
                            <th className="py-3 px-4">Calidad</th>
                            <th className="py-3 px-4 text-center">Tier</th>
                            <th className="py-3 px-4 text-center">Encant.</th>
                            <th className="py-3 px-4 text-right">Precio Venta (Comprar)</th>
                            <th className="py-3 px-4 text-right">Precio Compra (Vender)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-albion-border/20 text-xs font-medium">
                          {pricesData.prices.map((p, i) => {
                            const isCheapestBuy = p.city.trim().toLowerCase() !== "black market" && p.city === pricesData.recommendation.buy_city && p.sell_price_min === pricesData.recommendation.buy_price;
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
                                <td className="py-3.5 px-4 text-slate-300">
                                  {QUALITY_NAMES[p.quality] || "Normal"}
                                </td>
                                <td className="py-3.5 px-4 text-slate-300 text-center font-semibold">
                                  T{p.tier || "4"}
                                </td>
                                <td className="py-3.5 px-4 text-slate-300 text-center font-mono">
                                  .{p.enchantment || "0"}
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

      {dbLoaded && activeTab === "radar" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT PANEL: Zones List and Filters */}
          <section className="lg:col-span-5 border-r border-albion-border/40 bg-slate-950/20 p-5 flex flex-col gap-5 lg:overflow-hidden overflow-y-auto">
            {/* Cabecera del Radar */}
            <div className="flex flex-col gap-2 border-b border-albion-border/40 pb-3">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Risk Radar PvP</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">Auto-refresco: {refreshCountdown}s</span>
                  <button
                    onClick={() => fetchRadar(true)}
                    disabled={radarLoading}
                    className="p-1 bg-slate-900 border border-albion-border/80 hover:border-albion-gold text-slate-400 hover:text-albion-gold rounded text-xs transition cursor-pointer"
                    title="Actualizar ahora"
                  >
                    {radarLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent animate-spin rounded-full"></div>
                    ) : (
                      "🔄"
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 font-medium">
                  Última actualización: {lastRadarUpdate ? lastRadarUpdate.toLocaleTimeString() : "N/D"}
                </span>
                <span className="text-amber-500 font-semibold font-mono uppercase tracking-wider">
                  {server.toUpperCase()} Server
                </span>
              </div>
            </div>

            {/* Buscador y Filtros */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar mapa..."
                  value={radarSearchQuery}
                  onChange={(e) => setRadarSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-albion-border/80 focus:border-albion-gold text-xs text-slate-200 pl-4.5 pr-8 py-2.5 rounded-md outline-none transition-all placeholder-slate-600 font-semibold"
                />
                {radarSearchQuery && (
                  <button
                    onClick={() => setRadarSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 text-[10px] font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Zona</label>
                  <select
                    value={radarFilterType}
                    onChange={(e) => setRadarFilterType(e.target.value)}
                    className="w-full bg-slate-900 border border-albion-border/60 text-[11px] text-slate-300 px-2 py-1.5 rounded outline-none focus:border-albion-gold font-bold"
                  >
                    <option value="All">TODAS</option>
                    <option value="Red Zone">Zona Roja</option>
                    <option value="Black Zone">Zona Negra</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Riesgo</label>
                  <select
                    value={radarFilterRisk}
                    onChange={(e) => setRadarFilterRisk(e.target.value)}
                    className="w-full bg-slate-900 border border-albion-border/60 text-[11px] text-slate-300 px-2 py-1.5 rounded outline-none focus:border-albion-gold font-bold"
                  >
                    <option value="All">TODOS</option>
                    <option value="red">Extremo (Rojo)</option>
                    <option value="orange">Peligroso (Naranja)</option>
                    <option value="yellow">Precaución (Amarillo)</option>
                    <option value="green">Seguro (Verde)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Listado de Zonas */}
            <div className="flex-1 flex flex-col min-h-[300px]">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2.5">
                Mapas Analizados ({radarData ? radarData.zones.length : 0})
              </label>

              {radarLoading && !radarData && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-albion-gold animate-spin mb-3"></div>
                  <p className="text-xs text-slate-400 font-medium">Analizando actividad reciente...</p>
                </div>
              )}

              {radarError && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-red-400 text-lg mb-2">✕</div>
                  <p className="text-xs text-slate-400">{radarError}</p>
                </div>
              )}

              {radarData && (
                <div className="flex-1 bg-slate-950/50 border border-albion-border/30 rounded-md overflow-y-auto lg:max-h-[320px] max-h-[420px] divide-y divide-albion-border/20">
                  {radarData.zones
                    .filter(z => {
                      const matchSearch = z.name.toLowerCase().includes(radarSearchQuery.toLowerCase());
                      const matchType = radarFilterType === "All" || z.type === radarFilterType;
                      const matchRisk = radarFilterRisk === "All" || z.risk_level === radarFilterRisk;
                      return matchSearch && matchType && matchRisk;
                    })
                    .map((zone) => {
                      const riskColors = {
                        green: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "Seguro" },
                        yellow: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", label: "Precaución" },
                        orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", label: "Peligroso" },
                        red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", label: "Extremo" }
                      };
                      const colors = riskColors[zone.risk_level] || riskColors.green;
                      const isSelected = selectedZone && selectedZone.name === zone.name;

                      return (
                        <button
                          key={zone.name}
                          onClick={() => setSelectedZone(zone)}
                          className={`w-full text-left px-4 py-3 text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/10 text-albion-gold border-l-2 border-albion-gold'
                              : 'text-slate-300 hover:bg-slate-900/60 hover:text-slate-100'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <span className="font-bold truncate">{zone.name}</span>
                            <span className="text-[9px] text-slate-500 font-medium">
                              {zone.type} • {zone.death_count} {zone.death_count === 1 ? 'muerte' : 'muertes'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-mono text-slate-400">
                              SV: {Math.round((zone.survival_gathering + zone.survival_farming + zone.survival_transport) / 3)}%
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${colors.bg} ${colors.border} ${colors.text} uppercase tracking-wider`}>
                              {colors.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANEL: Zone Details and Statistics */}
          <section className="lg:col-span-7 p-6 flex flex-col overflow-y-auto bg-slate-950/10">
            {!selectedZone ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-16 h-16 bg-slate-900 border border-albion-border/40 rounded-full flex items-center justify-center mb-4 text-2xl text-slate-600 shadow-inner">
                  📡
                </div>
                <h3 className="text-sm font-bold font-display uppercase text-slate-400 tracking-wider">Radar PvP</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">Selecciona una zona del panel de la izquierda para ver el historial detallado de gankeo, perfiles de IP y tasas de supervivencia estimadas.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* Cabecera del Detalle */}
                <div className="border-b border-albion-border/60 pb-3.5 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">Análisis de Riesgo Local</span>
                    <h2 className="text-xl font-bold text-slate-100 mt-0.5 font-display tracking-wide flex items-center gap-2.5">
                      {selectedZone.name}
                      <span className={`text-[10px] px-2 py-0.5 rounded font-sans font-bold border uppercase tracking-wider ${
                        selectedZone.risk_level === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                        selectedZone.risk_level === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                        selectedZone.risk_level === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {selectedZone.risk_level === 'red' ? 'Extremo' :
                         selectedZone.risk_level === 'orange' ? 'Peligroso' :
                         selectedZone.risk_level === 'yellow' ? 'Precaución' : 'Seguro'}
                      </span>
                    </h2>
                  </div>
                  <span className="text-slate-500 text-[10px] font-semibold uppercase font-sans tracking-widest">{selectedZone.type}</span>
                </div>

                {/* Tarjetas de Métricas de Supervivencia */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Gathering Card */}
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-albion-border/60 rounded-lg p-4 shadow-md flex flex-col gap-2 relative overflow-hidden group">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Recolectar (Gathering)</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-2xl font-bold font-display ${
                        selectedZone.survival_gathering >= 80 ? 'text-emerald-400' :
                        selectedZone.survival_gathering >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {selectedZone.survival_gathering}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">de supervivencia</span>
                    </div>
                    {/* Barra de Progreso */}
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-albion-border/30 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedZone.survival_gathering >= 80 ? 'bg-emerald-500' :
                          selectedZone.survival_gathering >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${selectedZone.survival_gathering}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Farming Card */}
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-albion-border/60 rounded-lg p-4 shadow-md flex flex-col gap-2 relative overflow-hidden group">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Farming (Mobs/Dungeons)</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-2xl font-bold font-display ${
                        selectedZone.survival_farming >= 80 ? 'text-emerald-400' :
                        selectedZone.survival_farming >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {selectedZone.survival_farming}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">de supervivencia</span>
                    </div>
                    {/* Barra de Progreso */}
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-albion-border/30 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedZone.survival_farming >= 80 ? 'bg-emerald-500' :
                          selectedZone.survival_farming >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${selectedZone.survival_farming}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Transport Card */}
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-albion-border/60 rounded-lg p-4 shadow-md flex flex-col gap-2 relative overflow-hidden group">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Transportar Recursos</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-2xl font-bold font-display ${
                        selectedZone.survival_transport >= 80 ? 'text-emerald-400' :
                        selectedZone.survival_transport >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {selectedZone.survival_transport}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">de supervivencia</span>
                    </div>
                    {/* Barra de Progreso */}
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-albion-border/30 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedZone.survival_transport >= 80 ? 'bg-emerald-500' :
                          selectedZone.survival_transport >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${selectedZone.survival_transport}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Métricas de Gankers */}
                {selectedZone.death_count > 0 && (
                  <div className="bg-slate-900/40 border border-albion-border/50 rounded-lg p-4 flex flex-col gap-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estadísticas de Amenazas Recientes</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 border border-albion-border/30 px-4 py-3 rounded-md flex items-center justify-between">
                        <span className="text-xs text-slate-400">Tamaño Grupo de Gankers:</span>
                        <span className="text-sm font-bold font-mono text-amber-500">{selectedZone.avg_group_size} jugadores</span>
                      </div>
                      <div className="bg-slate-950/40 border border-albion-border/30 px-4 py-3 rounded-md flex items-center justify-between">
                        <span className="text-xs text-slate-400">Poder de Item (IP) Promedio:</span>
                        <span className="text-sm font-bold font-mono text-amber-500">{selectedZone.avg_killer_ip} IP</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feed de Muertes */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Muertes Recientes en este mapa ({selectedZone.deaths.length})
                  </h3>

                  {selectedZone.deaths.length === 0 ? (
                    <div className="bg-slate-900/30 border border-albion-border/20 rounded-md p-8 text-center text-slate-500">
                      <div className="text-2xl mb-2">🌿</div>
                      <p className="text-xs font-semibold text-slate-400">Sin muertes recientes</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">No se detectaron actividades hostiles recientes en este mapa en los últimos 50 eventos.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedZone.deaths.map((death, i) => {
                        const dateStr = death.timestamp ? new Date(death.timestamp).toLocaleTimeString() : "";
                        return (
                          <div 
                            key={i} 
                            onClick={() => setSelectedDeath(death)}
                            className="bg-slate-900/60 border border-albion-border/40 hover:border-albion-gold/40 hover:bg-slate-900/80 rounded-lg p-4 flex flex-col gap-3.5 transition duration-150 cursor-pointer group/death relative"
                          >
                            {/* Línea Principal (Asesino y Víctima) */}
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-red-400">{death.killer_name}</span>
                                  {death.killer_guild && (
                                    <span className="text-[10px] text-slate-400">[{death.killer_guild}]</span>
                                  )}
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">asesinó a</span>
                                  <span className="text-xs font-bold text-slate-200">{death.victim_name}</span>
                                  {death.victim_guild && (
                                    <span className="text-[10px] text-slate-400">[{death.victim_guild}]</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium flex-wrap">
                                  <span>Gankers: {death.group_size}</span>
                                  <span>•</span>
                                  <span>Fama Perdida: <span className="font-mono text-amber-500/80">{formatSilver(death.fame)}</span></span>
                                  <span>•</span>
                                  <span>Hora: {dateStr}</span>
                                  <span>•</span>
                                  <span className="px-2 py-0.5 bg-amber-500/10 hover:bg-albion-gold text-albion-gold hover:text-slate-950 border border-albion-gold/30 hover:border-transparent rounded text-[9px] font-bold transition duration-150 uppercase tracking-wider flex items-center gap-1">
                                    Ver Detalles 💀
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end shrink-0 gap-1">
                                <span className="text-[10px] font-bold text-slate-400">Víctima: {death.victim_ip} IP</span>
                                <span className="text-[10px] font-bold text-red-500/80">Asesino: {death.killer_ip} IP</span>
                              </div>
                            </div>

                            {/* Detalle de Ítems Perdidos de la Víctima */}
                            {(death.equipment.length > 0 || death.inventory.length > 0) && (
                              <div className="border-t border-albion-border/20 pt-2.5">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Equipamiento & Inventario perdido</span>
                                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                                  {/* Mostrar Equipamiento */}
                                  {death.equipment.map((item, idx) => (
                                    <span key={`eq-${idx}`} className="text-[9px] font-semibold bg-slate-950/80 border border-albion-gold/20 text-slate-300 px-2 py-1 rounded flex items-center gap-1.5" title={item.id}>
                                      <div className="w-5 h-5 flex items-center justify-center shrink-0 overflow-hidden">
                                        <LazyLoadImage
                                          src={`https://render.albiononline.com/v1/item/${item.id}.png`}
                                          effect="blur"
                                          className="w-5 h-5 object-contain"
                                          alt={item.name}
                                        />
                                      </div>
                                      <span className="truncate max-w-[90px]">{item.name} {item.count > 1 ? `x${item.count}` : ""}</span>
                                    </span>
                                  ))}
                                  {/* Mostrar Inventario */}
                                  {death.inventory.map((item, idx) => (
                                    <span key={`inv-${idx}`} className="text-[9px] font-medium bg-slate-950/40 border border-slate-800 text-slate-400 px-2 py-1 rounded flex items-center gap-1.5" title={item.id}>
                                      <div className="w-5 h-5 flex items-center justify-center shrink-0 overflow-hidden">
                                        <LazyLoadImage
                                          src={`https://render.albiononline.com/v1/item/${item.id}.png`}
                                          effect="blur"
                                          className="w-5 h-5 object-contain"
                                          alt={item.name}
                                        />
                                      </div>
                                      <span className="truncate max-w-[90px]">{item.name} {item.count > 1 ? `x${item.count}` : ""}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900/30 border border-albion-border/20 rounded p-3 text-[10px] text-slate-500 flex gap-2 items-center mt-2">
                  <span>ℹ</span>
                  <span>El porcentaje de supervivencia es una estimación en base al volumen de muertes, la cantidad promedio de gankers y su Item Power (IP) actual. Si viajas en grupo o usas builds específicas de escape, tus posibilidades de supervivencia aumentarán significativamente.</span>
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

      {/* MODAL DE DETALLE DE MUERTE */}
      {selectedDeath && (() => {
        const eqMap = {};
        selectedDeath.equipment.forEach(item => {
          eqMap[item.slot] = item;
        });

        const slotsLayout = [
          [ { slot: "Bag", label: "Bolsa", icon: "🎒" }, { slot: "Head", label: "Cabeza", icon: "🪖" }, { slot: "Cape", label: "Capa", icon: "🧣" } ],
          [ { slot: "MainHand", label: "Mano Principal", icon: "⚔️" }, { slot: "Armor", label: "Pecho", icon: "👕" }, { slot: "OffHand", label: "Mano Secundaria", icon: "🛡️" } ],
          [ { slot: "Food", label: "Comida", icon: "🍖" }, { slot: "Shoes", label: "Pies", icon: "🥾" }, { slot: "Potion", label: "Poción", icon: "🧪" } ],
          [ null, { slot: "Mount", label: "Montura", icon: "🐴" }, null ]
        ];

        const downloadScreenshot = () => {
          const element = document.getElementById("kill-card-screenshot");
          if (!element) return;
          
          html2canvas(element, {
            useCORS: true,
            backgroundColor: "#0a0c10",
            scale: 2
          }).then(async (canvas) => {
            const dataUrl = canvas.toDataURL("image/png");
            const filename = `muerte_${selectedDeath.victim_name}_${selectedDeath.event_id}.png`;
            
            if (window.pywebview && window.pywebview.api && !api.current.isMock) {
              try {
                const res = await api.current.saveScreenshot(dataUrl, filename);
                if (res && res.success) {
                  alert("Captura guardada con éxito en:\n" + res.saved_path);
                } else if (res && res.error && res.error !== "Cancelado.") {
                  alert("Error al guardar captura: " + res.error);
                }
              } catch (err) {
                console.error("Error al guardar captura por API:", err);
                alert("Error al intentar guardar la captura: " + err.toString());
              }
            } else {
              const link = document.createElement("a");
              link.download = filename;
              link.href = dataUrl;
              link.click();
            }
          }).catch(err => {
            console.error("Error al generar captura:", err);
            alert("No se pudo generar la captura. Inténtelo de nuevo.");
          });
        };

        const dateStr = selectedDeath.timestamp ? new Date(selectedDeath.timestamp).toLocaleString() : "N/D";

        const totalItemsCount = selectedDeath.equipment.reduce((sum, item) => sum + (item.count || 1), 0) +
                                selectedDeath.inventory.reduce((sum, item) => sum + (item.count || 1), 0);

        const getQualityBorderClass = (quality) => {
          switch(quality) {
            case 2: return "border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)] bg-slate-950 hover:border-emerald-400"; // Bueno
            case 3: return "border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.2)] bg-slate-950 hover:border-blue-400";   // Sobresaliente
            case 4: return "border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.2)] bg-slate-950 hover:border-purple-400"; // Excelente
            case 5: return "border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.3)] bg-slate-950 hover:border-amber-400"; // Obra Maestra
            default: return "border-slate-700 bg-slate-950 hover:border-slate-500"; // Normal / Default
          }
        };

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto flex justify-center items-start p-4 animate-fadeIn">
            <div className="bg-slate-950 border border-albion-gold/40 rounded-lg max-w-3xl w-full shadow-2xl relative flex flex-col my-8">
              
              {/* Controles de Cabecera del Modal (No se capturan) */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-albion-border/60 bg-slate-950">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                  <span>💀</span> Detalle de Combate PvP
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadScreenshot}
                    disabled={loadingDeathImages}
                    className={`px-3.5 py-1.5 border rounded text-xs font-bold uppercase tracking-wider transition duration-150 flex items-center gap-2 cursor-pointer ${
                      loadingDeathImages
                        ? "bg-slate-850 text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
                        : "bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border-albion-gold/30 hover:border-amber-400"
                    }`}
                  >
                    <span>📷</span> {loadingDeathImages ? "Cargando..." : "Descargar Captura"}
                  </button>
                  <button
                    onClick={() => setSelectedDeath(null)}
                    className="text-slate-400 hover:text-slate-100 text-lg font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Contenedor Capturable de la Ficha de Muerte */}
              <div id="kill-card-screenshot" className="p-6 flex flex-col gap-6 bg-slate-950 text-slate-100">
                
                {/* Cabecera del Combate */}
                <div className="flex justify-between items-center border-b border-albion-border/40 pb-4 flex-wrap gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Víctima</span>
                    <span className="text-base font-bold text-slate-200">{selectedDeath.victim_name}</span>
                    {selectedDeath.victim_guild && (
                      <span className="text-xs text-slate-400 block mt-0.5">Guild: [{selectedDeath.victim_guild}] {selectedDeath.victim_alliance ? `[${selectedDeath.victim_alliance}]` : ''}</span>
                    )}
                  </div>
                  <div className="text-center bg-red-950/20 border border-red-500/30 px-4 py-2 rounded">
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest block">Fama de Muerte</span>
                    <span className="text-lg font-bold text-red-500 font-mono">{formatSilver(selectedDeath.fame)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Asesino Principal</span>
                    <span className="text-base font-bold text-red-400">{selectedDeath.killer_name}</span>
                    {selectedDeath.killer_guild && (
                      <span className="text-xs text-slate-400 block mt-0.5">Guild: [{selectedDeath.killer_guild}] {selectedDeath.killer_alliance ? `[${selectedDeath.killer_alliance}]` : ''}</span>
                    )}
                  </div>
                </div>

                {/* Grid de Equipamiento e Inventario */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Vista de Equipamiento (Albion Style Grid) */}
                  <div className="md:col-span-6 flex flex-col items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block text-center">Como iba Equipado (IP: {selectedDeath.victim_ip})</span>
                    <div className="bg-slate-900/40 border border-albion-border/60 rounded-lg p-5 w-full max-w-[280px] flex flex-col items-center justify-center gap-3 relative shadow-inner">
                      
                      {slotsLayout.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-3 justify-center items-center">
                          {row.map((slotInfo, sIdx) => {
                            if (!slotInfo) return <div key={sIdx} className="w-14 h-14 invisible"></div>;
                            const item = eqMap[slotInfo.slot];
                            const qClass = item ? getQualityBorderClass(item.quality) : "bg-slate-950/20 border-slate-800/80 text-slate-600";
                            
                            return (
                              <div 
                                key={sIdx}
                                className={`w-14 h-14 rounded-md border flex flex-col items-center justify-center relative overflow-hidden group/slot ${qClass}`}
                                title={item ? `${item.name} (${slotInfo.label}) - ${QUALITY_NAMES[item.quality] || 'Normal'}` : slotInfo.label}
                              >
                                {item ? (
                                  <>
                                    <img
                                      src={deathItemImages[item.id] || `https://render.albiononline.com/v1/item/${item.id}.png`}
                                      className="w-12 h-12 object-contain"
                                      alt={item.name}
                                      crossOrigin="anonymous"
                                    />
                                    {item.count > 1 && (
                                      <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold bg-slate-950/90 text-amber-400 px-1 rounded border border-albion-gold/20 leading-none">
                                        x{item.count}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center">
                                    <span className="text-base opacity-40">{slotInfo.icon}</span>
                                    <span className="text-[8px] uppercase tracking-wide opacity-20 font-bold mt-0.5 scale-90">{slotInfo.label}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Inventario Perdido */}
                  <div className="md:col-span-6 flex flex-col gap-3 h-full">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Inventario Perdido ({selectedDeath.inventory.length} ranuras)</span>
                    <div className="bg-slate-900/20 border border-albion-border/40 rounded-lg p-4 flex-1 max-h-[290px] overflow-y-auto min-h-[220px]">
                      {selectedDeath.inventory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                          <span className="text-lg">🎒</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Inventario Vacío</span>
                          <p className="text-[9px] text-slate-600 max-w-[150px] mt-0.5">La víctima no llevaba ningún ítem suelto en su mochila.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {selectedDeath.inventory.map((item, idx) => {
                            const invQClass = getQualityBorderClass(item.quality);
                            return (
                              <div 
                                key={idx}
                                className={`w-12 h-12 rounded border flex items-center justify-center relative overflow-hidden group/inv ${invQClass}`}
                                title={`${item.name} x${item.count} (${QUALITY_NAMES[item.quality] || 'Normal'})`}
                              >
                                <img
                                  src={deathItemImages[item.id] || `https://render.albiononline.com/v1/item/${item.id}.png`}
                                  className="w-10 h-10 object-contain"
                                  alt={item.name}
                                  crossOrigin="anonymous"
                                />
                                {item.count > 1 && (
                                  <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold bg-slate-950/90 text-slate-300 px-0.5 rounded leading-none">
                                    {item.count}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Comparación de Estadísticas de Combate */}
                <div className="bg-slate-900/40 border border-albion-border/60 rounded-lg p-4 flex flex-col gap-3.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información Adicional del Encuentro</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="flex flex-col gap-1 bg-slate-950/40 border border-albion-border/30 px-3.5 py-2.5 rounded-md">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Fecha y Hora</span>
                      <span className="text-slate-300 font-mono text-[11px] truncate">{dateStr}</span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-950/40 border border-albion-border/30 px-3.5 py-2.5 rounded-md">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Asesinos Involucrados</span>
                      <span className="text-amber-500">{selectedDeath.group_size} {selectedDeath.group_size === 1 ? 'ganker' : 'gankers'}</span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-950/40 border border-albion-border/30 px-3.5 py-2.5 rounded-md">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Gear del Asesino</span>
                      <span className="text-red-400 font-mono">{selectedDeath.killer_ip} IP</span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-950/40 border border-albion-border/30 px-3.5 py-2.5 rounded-md">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Objetos Perdidos</span>
                      <span className="text-amber-400 font-mono">{totalItemsCount} {totalItemsCount === 1 ? 'ítem' : 'ítems'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer de la Captura */}
                <div className="border-t border-albion-border/40 pt-3 flex justify-between items-center text-[9px] text-slate-600 font-semibold tracking-wider uppercase">
                  <span>Albion Market PvP Radar v1.0.0</span>
                  <span>Servidor: {server.toUpperCase()}</span>
                </div>

              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
