"""Consultas territoriais administrativas."""
from functools import lru_cache
import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from shapely import union_all
from shapely.geometry import Point

from ..access.auth import current_user
from ..engine.geography.territory import Territory
from ..engine.geography.coverage import local_coverage, coverage_by_sector
from ..engine.geography.block_plan import plan_blocks
from ..engine.inference.analysis import RECORTES

router = APIRouter(prefix='/api/territorio', tags=['Território'], dependencies=[Depends(current_user)])


@lru_cache(maxsize=1)
def get_territory():
    try:
        return Territory()
    except (OSError, ValueError, KeyError) as error:
        raise HTTPException(503, 'Malha territorial indisponível ou inválida.') from error


class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ids: list[str] = Field(max_length=5000)


class Drawing(BaseModel):
    model_config = ConfigDict(extra='forbid')
    geometry: dict


class BlockPlan(Selection):
    block_m: int = Field(ge=50, le=2000)


class PointValidation(Selection):
    fonte_malha: str = Field(min_length=1, max_length=128)
    pontos: list[tuple[float, float]] = Field(min_length=1, max_length=10000)

    @field_validator('pontos')
    @classmethod
    def valid_coordinates(cls, value):
        if any(not math.isfinite(lon) or not math.isfinite(lat) or abs(lon) > 180 or abs(lat) > 90 for lon, lat in value):
            raise ValueError('Informe pontos válidos em longitude e latitude WGS84.')
        return value


@router.get('/setores')
def sectors():
    return get_territory().collection


@router.post('/resumo')
def summary(body: Selection):
    try:
        return get_territory().summary(body.ids)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/intersecoes')
def intersection(body: Drawing):
    try:
        return {'ids': get_territory().intersect(body.geometry)}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/validar-pontos')
def validate_points(body: PointValidation):
    territory = get_territory()
    try:
        if body.fonte_malha != territory.metadata['sha256_fonte']:
            raise ValueError('A versão da malha territorial mudou; recarregue a análise.')
        geometries = territory.selected(body.ids)
        if not geometries:
            raise ValueError('A camada precisa de setores de origem para validar a edição.')
        area = union_all(geometries)
        return {'fora': [index for index, (lon, lat) in enumerate(body.pontos) if not area.covers(Point(lon, lat))]}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/cobertura-local')
def coverage(body: Selection):
    try:
        return local_coverage(get_territory(), body.ids, RECORTES)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/cobertura-por-setor')
def sector_coverage(body: Selection):
    try:
        return coverage_by_sector(get_territory(), body.ids, RECORTES)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/plano-blocos')
def blocks(body: BlockPlan):
    try:
        return plan_blocks(get_territory(), body.ids, body.block_m)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/geojson')
def geojson(body: Selection):
    territory = get_territory()
    try:
        result = territory.summary(body.ids, include_geometry=True)
        if not result['geometry']:
            raise ValueError('Selecione pelo menos um setor para exportar.')
        return {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {},
                'geometry': result['geometry']}], 'arboriza': {'fonte': territory.metadata,
                'setores': body.ids, 'area_m2': result['area_m2']}}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
