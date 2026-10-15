#pragma once

namespace cli {

// Reads the serial console without blocking; call from loop(). Type "help".
void poll();

// Prints the periodic one-line summary (also what the "status" command shows).
void printSummary();

// True while the periodic summary is enabled ("verbose on|off").
bool verbose();

}  // namespace cli
