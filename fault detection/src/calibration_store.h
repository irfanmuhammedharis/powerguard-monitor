#pragma once
#include "calibration.h"

// Persists pg::Calibration in NVS (flash), namespace "pg". Survives re-flashing the
// firmware as long as the NVS partition is not erased.
pg::Calibration loadCalibration();
void saveCalibration(const pg::Calibration& cal);
void clearCalibration();
