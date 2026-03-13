export interface StockSinVentasItem {
    BaseCol: string;
    descripcion: string;
    descripcionCorta: string;
    descripcionMarca: string;
    idMarca: number;
    descripcionClase: string;
    descripcionSeccion: string;
    stockTotal: number;
    cantidadDepositos: number;
    diasSinVenta: number | null;
    fechaUltimaVenta: string | null;
    pvp: number | null;
    ultimoCosto: number | null;
    valorInventario: number;
}

export interface StockSinVentasResponse {
    items: StockSinVentasItem[];
    resumen: {
        totalArticulos: number;
        totalUnidadesStock: number;
        valorInventarioTotal: number;
        articulosSinVentaNunca: number;
        articulosSinVentaPeriodo: number;
    };
}
