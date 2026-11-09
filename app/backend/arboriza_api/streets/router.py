"""Diagnóstico viário associado a análises territoriais existentes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..analyses.router import read
from ..access.auth import current_user
from ..core.config import RESULTS
from ..territory.router import get_territory
from ..engine.geography.street_analysis import analyze_streets, read_sector_analysis
from ..engine.geography.street_canopies import select_canopies

router = APIRouter(prefix='/api/ruas', tags=['Ruas'], dependencies=[Depends(current_user)])


class Layer(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_camada: str = Field(min_length=1, max_length=128)
    ids_copas: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(max_length=10000)


class Diagnostic(BaseModel):
    model_config = ConfigDict(extra='forbid')
    analysis_id: str = Field(min_length=1, max_length=32)
    pontos: list[list[float]] | None = Field(default=None, min_length=1, max_length=50000)
    camadas: list[Layer] | None = Field(default=None, min_length=1, max_length=12)
    distancia_m: float = Field(default=25, ge=5, le=100, allow_inf_nan=False)

    @model_validator(mode='after')
    def validate_source(self):
        if (self.pontos is None) == (self.camadas is None):
            raise ValueError('Informe pontos ou camadas do v2, exclusivamente.')
        if self.camadas and sum(len(layer.ids_copas) for layer in self.camadas) > 50000:
            raise ValueError('Selecione até 50.000 registros.')
        return self


@router.post('/diagnostico')
def diagnostic(body: Diagnostic):
    record = read(body.analysis_id)
    if record['state'] != 'concluida':
        raise HTTPException(409, 'A análise ainda não está disponível.')
    try:
        territory = get_territory()
        ids = read_sector_analysis(body.analysis_id, RESULTS, territory)
        if body.camadas is not None:
            records, metadata = select_canopies(body.analysis_id, RESULTS, [x.model_dump() for x in body.camadas])
            result = analyze_streets(territory, ids, [r['coordinates'] for r in records], body.distancia_m, canopies=records)
            result['arboriza'].update(metadata)
            return result
        return analyze_streets(territory, ids, body.pontos, body.distancia_m)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except (OSError, KeyError, TypeError) as error:
        raise HTTPException(503, 'Não foi possível ler a base local de ruas.') from error
