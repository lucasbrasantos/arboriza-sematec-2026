"""Casos que podem suprimir copas vizinhas ou duplicar propostas de janelas."""
import unittest
import numpy as np
from backend.multiscale import aggregate, overlap


def proposal(ident, mask, offset=(0,0), score=.8):
    return {'id': ident, 'mask': np.array(mask, dtype=bool), 'offset': offset,
            'area': int(np.count_nonzero(mask)), 'score': score}


class MaskAggregationTests(unittest.TestCase):
    def test_disjoint_masks_with_same_bounds_remain_separate(self):
        a = proposal('a', [[1,0],[0,1]])
        b = proposal('b', [[0,1],[1,0]])
        kept, rejected = aggregate([a,b])
        self.assertEqual(overlap(a,b), (0,0))
        self.assertEqual(len(kept), 2)
        self.assertEqual(rejected, [])

    def test_clipped_duplicate_is_suppressed_by_containment(self):
        a = proposal('full', np.ones((4,4)))
        b = proposal('clipped', np.ones((2,2)), (1,1), .7)
        kept, rejected = aggregate([b,a])
        self.assertEqual([r['id'] for r in kept], ['full'])
        self.assertEqual(rejected[0]['suppressed_by'], 'full')
        self.assertEqual(rejected[0]['intersection_over_smaller_area'], 1)

    def test_distinct_offsets_are_not_merged(self):
        a = proposal('a', np.ones((3,3)))
        b = proposal('b', np.ones((3,3)), (3,0))
        self.assertEqual(len(aggregate([a,b])[0]), 2)

    def test_complement_cannot_replace_primary_mask(self):
        primary = proposal('200', np.ones((3,3)), score=.2)
        extra = proposal('100', np.ones((3,3)), score=.9)
        kept, rejected = aggregate([extra], anchors=[primary])
        self.assertEqual([p['id'] for p in kept], ['200'])
        self.assertEqual(rejected[0]['suppressed_by'], '200')

    def test_empty_inputs_and_masks_are_valid(self):
        self.assertEqual(aggregate([]), ([],[]))
        kept, rejected = aggregate([proposal('empty', np.zeros((2,2)))])
        self.assertEqual(kept, [])
        self.assertEqual(rejected[0]['reason'], 'mascara_vazia')

    def test_containment_can_be_disabled_for_ablation(self):
        a = proposal('large', np.ones((4,4)))
        b = proposal('small', np.ones((2,2)), (1,1), .7)
        self.assertEqual(len(aggregate([a,b], containment=None)[0]), 2)


if __name__ == '__main__':
    unittest.main()
