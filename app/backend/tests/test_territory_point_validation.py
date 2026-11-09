import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from shapely.geometry import box

from arboriza_api.territory.router import PointValidation, validate_points


class FakeTerritory:
    metadata = {'sha256_fonte': 'mesh-v1'}

    def selected(self, ids):
        if ids != ['sector']:
            raise ValueError('Setor desconhecido.')
        return [box(-50.5, -21.3, -50.4, -21.2)]


class PointValidationTests(unittest.TestCase):
    @patch('arboriza_api.territory.router.get_territory', return_value=FakeTerritory())
    def test_interior_boundary_and_outside(self, _get):
        result = validate_points(PointValidation(ids=['sector'], fonte_malha='mesh-v1', pontos=[(-50.45, -21.25), (-50.5, -21.25), (-50.39, -21.25)]))
        self.assertEqual(result, {'fora': [2]})

    @patch('arboriza_api.territory.router.get_territory', return_value=FakeTerritory())
    def test_refuses_changed_mesh_and_unknown_sector(self, _get):
        for ids, mesh in [(['sector'], 'old'), (['unknown'], 'mesh-v1')]:
            with self.subTest(ids=ids, mesh=mesh), self.assertRaises(HTTPException) as error:
                validate_points(PointValidation(ids=ids, fonte_malha=mesh, pontos=[(-50.45, -21.25)]))
            self.assertEqual(error.exception.status_code, 422)

    def test_refuses_invalid_coordinates(self):
        for point in [(float('nan'), 0), (181, 0), (0, 91)]:
            with self.subTest(point=point), self.assertRaises(ValidationError):
                PointValidation(ids=['sector'], fonte_malha='mesh-v1', pontos=[point])


if __name__ == '__main__':
    unittest.main()
