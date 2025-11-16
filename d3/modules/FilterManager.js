class FilterManager {
    constructor() {
        this.filters = {
            contaminante: 'CO',
            estacion: [],
            municipio: [],
            fuente: '',
            combustible: ''
        };
        this.onFiltersChange = null;
        this.dataLoader = null;
        this.fuentesData = [];
        this.todasLasEstaciones = [];
        this.todosLosMunicipios = [];
    }

    init(dataLoader, fuentesData, onFiltersChange) {
        this.dataLoader = dataLoader;
        this.fuentesData = fuentesData;
        this.onFiltersChange = onFiltersChange;
        
        this.setupDropdowns();
        this.setupEventListeners();
        
        // Activar todas las estaciones por defecto
        this.activarTodasEstaciones();
        // Activar todos los municipios por defecto
        this.activarTodosMunicipios();
        
        // Aplicar filtros iniciales
        this.applyFilters();
    }

    setupDropdowns() {
        console.log('DataLoader en FilterManager:', this.dataLoader);
        
        // Obtener contaminantes dinámicos de stations_permits_matrix
        const contaminantes = this.dataLoader.stationsPermitsMatrix ? 
            [...new Set(this.dataLoader.stationsPermitsMatrix.map(item => item.Variable))].filter(Boolean).sort() : 
            ['PM2.5', 'PM10', 'CO', 'NO2', 'SO2', 'O3'];
        
        // Usar dataLoader para obtener datos dinámicos
        const tiposFuente = this.dataLoader.getUniqueValues(this.fuentesData, 'TipoFuenteEmision');
        const combustibles = this.dataLoader.getUniqueValues(this.fuentesData, 'TipoCombustible');
        
        // Obtener municipios de emission_permits.csv
        this.todosLosMunicipios = this.dataLoader.getUniqueValues(this.fuentesData, 'Municipio').sort();

        // Obtener estaciones de los datos cargados
        this.todasLasEstaciones = this.dataLoader.stationsData ? 
            this.dataLoader.stationsData.map(station => `Estación ${station.id}`) : 
            ['Estación Centro', 'Estación Norte', 'Estación Sur', 'Estación Occidental'];

        console.log('Contaminantes dinámicos:', contaminantes);
        console.log('Tipos de fuente:', tiposFuente);
        console.log('Combustibles:', combustibles);
        console.log('Municipios:', this.todosLosMunicipios);
        console.log('Estaciones:', this.todasLasEstaciones);

        this.populateStandardDropdown('contaminante', contaminantes, true);
        this.populateStandardDropdown('fuente', tiposFuente);
        this.populateStandardDropdown('combustible', combustibles);
        this.populateCustomDropdown('estacion', this.todasLasEstaciones, true);
        this.populateCustomDropdown('municipio', this.todosLosMunicipios, true);

        // Establecer CO como valor por defecto en el dropdown
        const contaminanteSelect = document.getElementById('contaminante');
        if (contaminanteSelect) {
            contaminanteSelect.value = 'CO';
        }

        // Actualizar el texto del dropdown de estaciones y municipios
        this.updateSelectedText('estacion', document.querySelector('#estacion-trigger .selected-text'));
        this.updateSelectedText('municipio', document.querySelector('#municipio-trigger .selected-text'));
        this.updateEstacionesCount();
    }

    populateStandardDropdown(id, options, sinSeleccione = false) {
        const select = document.getElementById(id);
        if (!select) {
            console.error(`Elemento no encontrado: ${id}`);
            return;
        }
        
        // Limpiar TODAS las opciones existentes si es sin "Seleccione"
        if (sinSeleccione) {
            select.innerHTML = '';
        } else {
            // Limpiar opciones existentes (excepto la primera opción por defecto)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
        }
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
    }

    populateCustomDropdown(type, options, hasTodasOption = false) {
        const container = document.getElementById(`${type}-options`);
        if (!container) {
            console.error(`Contenedor no encontrado: ${type}-options`);
            return;
        }
        
        container.innerHTML = '';

        // Agregar la opción "Todas" si está habilitada
        if (hasTodasOption) {
            const opcionTodas = document.createElement('div');
            opcionTodas.className = 'dropdown-option opcion-todas';
            const label = type === 'estacion' ? 'Todas las estaciones' : 'Todos los municipios';
            opcionTodas.innerHTML = `
                <input type="checkbox" id="${type}-todas">
                <label for="${type}-todas">${label}</label>
            `;
            container.appendChild(opcionTodas);
        }
        
        options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'dropdown-option';
            const safeId = `${type}-${option.toString().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
            optionElement.innerHTML = `
                <input type="checkbox" id="${safeId}" value="${option}">
                <label for="${safeId}">${option}</label>
            `;
            container.appendChild(optionElement);
        });
    }

    setupEventListeners() {
        // Dropdowns estándar
        const contaminanteSelect = document.getElementById('contaminante');
        const fuenteSelect = document.getElementById('fuente');
        const combustibleSelect = document.getElementById('combustible');

        if (contaminanteSelect) {
            contaminanteSelect.addEventListener('change', (e) => {
                this.filters.contaminante = e.target.value;
                this.applyFilters();
            });
        }

        if (fuenteSelect) {
            fuenteSelect.addEventListener('change', (e) => {
                this.filters.fuente = e.target.value;
                this.applyFilters();
            });
        }

        if (combustibleSelect) {
            combustibleSelect.addEventListener('change', (e) => {
                this.filters.combustible = e.target.value;
                this.applyFilters();
            });
        }

        // Dropdowns personalizados
        this.initCustomDropdown('estacion', true);
        this.initCustomDropdown('municipio', true);

        // Botón reset
        const resetButton = document.getElementById('reset-filters');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        // Cerrar dropdowns al hacer clic fuera y verificar estaciones
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-dropdown-container')) {
                this.closeAllDropdowns();
                // Verificar si no hay estaciones seleccionadas después de cerrar
                if (this.filters.estacion.length === 0) {
                    this.activarTodasEstaciones();
                    this.applyFilters();
                }
            }
        });
    }

    initCustomDropdown(type, hasTodasOption = false) {
        const trigger = document.getElementById(`${type}-trigger`);
        const options = document.getElementById(`${type}-options`);
        
        if (!trigger || !options) {
            console.error(`Elementos no encontrados para dropdown: ${type}`);
            return;
        }

        const selectedText = trigger.querySelector('.selected-text');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = options.classList.contains('show');
            this.closeAllDropdowns();
            if (!isShowing) options.classList.add('show');
        });

        options.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') {
                const checkbox = e.target;
                const value = checkbox.value;

                // Manejar la opción "Todas"
                if (hasTodasOption && checkbox.id === `${type}-todas`) {
                    if (checkbox.checked) {
                        if (type === 'estacion') {
                            this.activarTodasEstaciones();
                        } else if (type === 'municipio') {
                            this.activarTodosMunicipios();
                        }
                    } else {
                        // Permitir desactivar "Todas" para ambos tipos
                        if (type === 'estacion') {
                            this.desactivarTodasEstaciones();
                        } else if (type === 'municipio') {
                            this.desactivarTodosMunicipios();
                        }
                    }
                } else {
                    // Manejar elementos individuales
                    if (checkbox.checked) {
                        this.filters[type].push(value);
                    } else {
                        this.filters[type] = this.filters[type].filter(item => item !== value);
                    }

                    // Si se desmarca alguna opción individual, desmarcar "Todas"
                    if (hasTodasOption && !checkbox.checked) {
                        if (type === 'estacion') {
                            this.desmarcarOpcionTodas();
                        } else if (type === 'municipio') {
                            this.desmarcarOpcionTodasMunicipios();
                        }
                    }

                    // Si se marcan todas las opciones individualmente, marcar "Todas"
                    if (hasTodasOption && checkbox.checked) {
                        if (type === 'estacion') {
                            this.verificarYMarcarTodasEstaciones();
                        } else if (type === 'municipio') {
                            this.verificarYMarcarTodasMunicipios();
                        }
                    }
                }

                this.updateSelectedText(type, selectedText);
                this.applyFilters();
                
                if (type === 'estacion') {
                    this.updateEstacionesCount();
                }
            }
        });
    }

    // Métodos para estaciones
    activarTodasEstaciones() {
        console.log('Activando todas las estaciones...');
        this.filters.estacion = [...this.todasLasEstaciones];
        this.marcarTodasCheckboxes('estacion', true);
        this.marcarOpcionTodas('estacion', true);
        this.updateSelectedText('estacion', document.querySelector('#estacion-trigger .selected-text'));
        this.updateEstacionesCount();
    }

    desactivarTodasEstaciones() {
        console.log('Desactivando todas las estaciones...');
        this.filters.estacion = [];
        this.marcarTodasCheckboxes('estacion', false);
        this.marcarOpcionTodas('estacion', false);
        this.updateSelectedText('estacion', document.querySelector('#estacion-trigger .selected-text'));
        this.updateEstacionesCount();
    }

    desmarcarOpcionTodas() {
        const todasCheckbox = document.getElementById('estacion-todas');
        if (todasCheckbox) {
            todasCheckbox.checked = false;
        }
    }

    marcarOpcionTodas(type, estado) {
        const todasCheckbox = document.getElementById(`${type}-todas`);
        if (todasCheckbox) {
            todasCheckbox.checked = estado;
        }
    }

    verificarYMarcarTodasEstaciones() {
        const todasSeleccionadas = this.filters.estacion.length === this.todasLasEstaciones.length;
        if (todasSeleccionadas) {
            this.marcarOpcionTodas('estacion', true);
        }
    }

    // Métodos para municipios
    activarTodosMunicipios() {
        console.log('Activando todos los municipios...');
        this.filters.municipio = [...this.todosLosMunicipios];
        this.marcarTodasCheckboxes('municipio', true);
        this.marcarOpcionTodas('municipio', true);
        this.updateSelectedText('municipio', document.querySelector('#municipio-trigger .selected-text'));
    }

    desactivarTodosMunicipios() {
        console.log('Desactivando todos los municipios...');
        this.filters.municipio = [];
        this.marcarTodasCheckboxes('municipio', false);
        this.marcarOpcionTodas('municipio', false);
        this.updateSelectedText('municipio', document.querySelector('#municipio-trigger .selected-text'));
    }

    desmarcarOpcionTodasMunicipios() {
        const todasCheckbox = document.getElementById('municipio-todas');
        if (todasCheckbox) {
            todasCheckbox.checked = false;
        }
    }

    verificarYMarcarTodasMunicipios() {
        const todasSeleccionadas = this.filters.municipio.length === this.todosLosMunicipios.length;
        if (todasSeleccionadas) {
            this.marcarOpcionTodas('municipio', true);
        }
    }

    marcarTodasCheckboxes(type, estado) {
        const container = document.getElementById(`${type}-options`);
        if (!container) return;

        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.id !== `${type}-todas`) {
                checkbox.checked = estado;
            }
        });
    }

    updateSelectedText(type, selectedTextElement) {
        const selected = this.filters[type];
        const todasLasOpciones = type === 'estacion' ? this.todasLasEstaciones : this.todosLosMunicipios;
        const labelTodas = type === 'estacion' ? 'Todas las estaciones' : 'Todos los municipios';
        
        if (selected.length === 0) {
            selectedTextElement.textContent = 'Seleccione';
        } else if (selected.length === 1) {
            selectedTextElement.textContent = selected[0];
        } else if (selected.length === todasLasOpciones.length) {
            selectedTextElement.textContent = labelTodas;
        } else {
            selectedTextElement.textContent = `${selected.length} seleccionados`;
        }
    }

    updateEstacionesCount() {
        const count = this.filters.estacion.length;
        const countElement = document.getElementById('estaciones-count');
        if (countElement) {
            countElement.textContent = count;
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.custom-dropdown-options').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    resetFilters() {
        this.filters = {
            contaminante: 'CO',
            estacion: [...this.todasLasEstaciones],
            municipio: [...this.todosLosMunicipios],
            fuente: '',
            combustible: ''
        };
        
        // Reset UI
        const contaminanteSelect = document.getElementById('contaminante');
        const fuenteSelect = document.getElementById('fuente');
        const combustibleSelect = document.getElementById('combustible');
        
        if (contaminanteSelect) contaminanteSelect.value = 'CO';
        if (fuenteSelect) fuenteSelect.value = '';
        if (combustibleSelect) combustibleSelect.value = '';
        
        // Actualizar checkboxes según los filtros reseteados
        this.marcarTodasCheckboxes('estacion', true);
        this.marcarOpcionTodas('estacion', true);
        this.marcarTodasCheckboxes('municipio', true);
        this.marcarOpcionTodas('municipio', true);
        
        // Actualizar textos
        document.querySelectorAll('.selected-text').forEach(text => {
            const type = text.closest('.custom-dropdown-trigger').id.replace('-trigger', '');
            this.updateSelectedText(type, text);
        });
        
        this.updateEstacionesCount();
        this.applyFilters();
    }

    applyFilters() {
        let filteredData = [...this.fuentesData];

        // Aplicar filtros
        if (this.filters.contaminante) {
            filteredData = this.filterByContaminante(filteredData, this.filters.contaminante);
        }

        if (this.filters.fuente) {
            filteredData = filteredData.filter(fuente => 
                fuente.TipoFuenteEmision === this.filters.fuente
            );
        }

        if (this.filters.combustible) {
            filteredData = filteredData.filter(fuente => 
                fuente.TipoCombustible === this.filters.combustible
            );
        }

        if (this.filters.municipio.length > 0) {
            filteredData = filteredData.filter(fuente => 
                this.filters.municipio.includes(fuente.Municipio)
            );
        }

        // Obtener IDs de estaciones activas
        const activeStations = this.filters.estacion.map(nombre => {
            const match = nombre.match(/Estación\s*(\d+)/);
            return match ? match[1] : nombre;
        });

        // Filtrar por estaciones activas
        if (activeStations.length > 0) {
            filteredData = this.filterByEstaciones(filteredData, activeStations);
        }

        console.log(`Datos filtrados: ${filteredData.length} de ${this.fuentesData.length}, Estaciones activas: ${activeStations}, Contaminante: ${this.filters.contaminante}, Municipios: ${this.filters.municipio.length}`);

        // Llamar al callback con datos filtrados y estaciones activas
        if (this.onFiltersChange) {
            this.onFiltersChange(filteredData, activeStations, this.filters.contaminante);
        }
    }

    filterByContaminante(data, contaminante) {
        return data.filter(fuente => {
            const relaciones = this.dataLoader.stationsPermitsMatrix.filter(rel => 
                rel.IDEmpresa === fuente.ID && 
                rel.Variable === contaminante
            );
            return relaciones.length > 0;
        });
    }

    filterByEstaciones(data, estacionesSeleccionadas) {
        console.log('Filtrando por estaciones activas:', estacionesSeleccionadas);

        return data.filter(fuente => {
            const relaciones = this.dataLoader.stationsPermitsMatrix.filter(rel => 
                rel.IDEmpresa === fuente.ID && 
                rel.DistanciaKm <= 15 &&
                estacionesSeleccionadas.includes(rel.IDEstación)
            );
            return relaciones.length > 0;
        });
    }

    getCurrentFilters() {
        return { ...this.filters };
    }
}