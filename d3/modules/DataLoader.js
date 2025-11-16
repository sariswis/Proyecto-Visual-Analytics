class DataLoader {
    constructor() {
        this.geoData = null;
        this.fuentesData = [];
        this.stationsData = [];
        this.stationsPermitsMatrix = [];
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadGeoData(),
                this.loadFuentesData(),
                this.loadStationsData(),
                this.loadStationsPermitsMatrix()
            ]);
            return {
                geoData: this.geoData,
                fuentesData: this.fuentesData,
                stationsData: this.stationsData,
                stationsPermitsMatrix: this.stationsPermitsMatrix
            };
        } catch (error) {
            console.error('Error cargando datos:', error);
            return this.loadExampleData();
        }
    }

    async loadGeoData() {
        this.geoData = await d3.json('../data/preparada/municipios_final.geojson');
        console.log('GeoJSON cargado:', this.geoData);
        return this.geoData;
    }

    async loadFuentesData() {
        const rawData = await d3.csv('../data/preparada/emission_permits.csv');
        
        this.fuentesData = rawData.map(fuente => ({
            ...fuente,
            Latitud: parseFloat(fuente.Latitud),
            Longitud: parseFloat(fuente.Longitud),
            ID: parseInt(fuente.ID)
        })).filter(fuente => 
            !isNaN(fuente.Latitud) && 
            !isNaN(fuente.Longitud) &&
            fuente.Latitud !== 0 && 
            fuente.Longitud !== 0
        );
        
        console.log('Datos de fuentes cargados:', this.fuentesData);
        return this.fuentesData;
    }

    async loadStationsData() {
        const rawData = await d3.csv('../data/preparada/stations.csv');
        
        this.stationsData = rawData.map(station => ({
            id: station.id,
            latitude: parseFloat(station.latitude),
            longitude: parseFloat(station.longitude)
        })).filter(station => 
            !isNaN(station.latitude) && 
            !isNaN(station.longitude)
        );
        
        console.log('Datos de estaciones cargados:', this.stationsData);
        return this.stationsData;
    }

    async loadStationsPermitsMatrix() {
        const rawData = await d3.csv('../data/preparada/stations_permits_matrix.csv');
        
        this.stationsPermitsMatrix = rawData.map(row => ({
            IDEstación: row.IDEstación,
            IDEmpresa: parseInt(row.IDEmpresa),
            DistanciaKm: parseFloat(row.DistanciaKm),
            Variable: row.Variable,
            Incidencia: row.Incidencia
        }));
        
        console.log('Matriz de relaciones cargada:', this.stationsPermitsMatrix);
        return this.stationsPermitsMatrix;
    }

    loadExampleData() {
        console.log('Cargando datos de ejemplo...');
        
        this.geoData = {
            "type": "FeatureCollection",
            "name": "municipios_final",
            "features": [
                {
                    "type": "Feature",
                    "properties": { 
                        "Código departamento": "25", 
                        "Departamento": "Cundinamarca", 
                        "Código municipio": "001", 
                        "Municipio": "MOSQUERA", 
                        "DIVIPOLA": "25001" 
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-74.22656074120917, 4.703417522164974],
                            [-74.216560, 4.700000],
                            [-74.220000, 4.710000],
                            [-74.230000, 4.710000],
                            [-74.22656074120917, 4.703417522164974]
                        ]]
                    }
                }
            ]
        };

        this.fuentesData = [
            {
                "ID": 1,
                "IDExpediente": "73640",
                "Estado": "Seguimiento y Control",
                "Regional": "Sabana Occidente",
                "Departamento": "Cundinamarca",
                "Municipio": "MOSQUERA",
                "Localidad": "",
                "Vereda": "CENTRO",
                "Class": "Sin sanción",
                "TipoCombustible": "Otros",
                "TipoFuenteEmision": "Horno",
                "Latitud": 4.703417522164974,
                "Longitud": -74.22656074120917,
                "PrecisionUbicacion": "Alta"
            }
        ];

        this.stationsData = [
            { id: "1", latitude: 4.7034, longitude: -74.2265 },
            { id: "2", latitude: 4.7100, longitude: -74.2200 }
        ];

        this.stationsPermitsMatrix = [
            { IDEstación: "1", IDEmpresa: 1, DistanciaKm: 0.5, Variable: "PM2.5", Incidencia: "Alta" }
        ];

        return {
            geoData: this.geoData,
            fuentesData: this.fuentesData,
            stationsData: this.stationsData,
            stationsPermitsMatrix: this.stationsPermitsMatrix
        };
    }

    // MÉTODOS CORREGIDOS - deben estar dentro de la clase
    getUniqueValues(data, field) {
        if (!data || !Array.isArray(data)) return [];
        return [...new Set(data.map(item => item[field]))].filter(Boolean).sort();
    }

    getGeoMunicipios() {
        if (!this.geoData || !this.geoData.features) return [];
        return this.geoData.features
            .map(f => f.properties.Municipio)
            .filter(Boolean)
            .sort();
    }
}