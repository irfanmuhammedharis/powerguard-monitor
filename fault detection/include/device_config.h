#pragma once
// Single include point for per-unit settings, with a readable error if the git-ignored
// secrets.h has not been created yet.
#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Missing include/secrets.h - copy include/secrets.example.h to include/secrets.h and fill it in."
#endif
