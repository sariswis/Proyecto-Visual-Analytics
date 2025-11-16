class Dashboard {
    constructor() {
        this.dataLoader = new DataLoader();
        this.mapManager = new MapManager('#map-svg');
        this.filterManager = new FilterManager();
        
        this.init();
    }

    async init() {
        try {
            console.log('Iniciando carga de datos...');
            
            const data = await this.dataLoader.loadAllData();
            
            console.log('Datos cargados:', {
                geoData: data.geoData?.features?.length,
                fuentesData: data.fuentesData?.length,
                stationsData: data.stationsData?.length,
                stationsPermitsMatrix: data.stationsPermitsMatrix?.length
            });
            
            this.mapManager.init(
                data.geoData, 
                data.fuentesData, 
                data.stationsData, 
                data.stationsPermitsMatrix
            );
            
            this.filterManager.init(this.dataLoader, data.fuentesData, (filteredData, activeStations, contaminante) => {
                console.log('Actualizando mapa con datos filtrados:', filteredData.length, 'estaciones activas:', activeStations, 'contaminante:', contaminante);
                this.mapManager.updateData(filteredData, activeStations, contaminante);
            });
            
            // Aplicar filtro inicial con CO
            this.filterManager.applyFilters();
            
        } catch (error) {
            console.error('Error inicializando dashboard:', error);
        }
    }
}

const dashboard = new Dashboard();