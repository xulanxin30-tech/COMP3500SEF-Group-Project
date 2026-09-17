# -*- coding: utf-8 -*-
"""Logistics Management System · Test template
Owner: ZHANGZHIYUAN
Note: Python standard library unittest, zero dependencies.
Run: python -m unittest tests/test_example.py
"""
import unittest


def calc_freight(weight_kg):
    """Sample business function: freight calculation (HKD per kg)"""
    return weight_kg * 2.5 if weight_kg > 0 else 0


class TestFreight(unittest.TestCase):
    """Freight function tests"""

    def test_normal(self):
        self.assertEqual(calc_freight(10), 25.0)

    def test_zero(self):
        self.assertEqual(calc_freight(0), 0)

    def test_negative(self):
        self.assertEqual(calc_freight(-5), 0)


if __name__ == "__main__":
    unittest.main()
