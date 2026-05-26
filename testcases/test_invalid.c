/*
 * testcases/test_invalid.c
 * Intentionally invalid C file to test compilation failure logging.
 */
#include <stdio.h>

int main() {
    // Syntax error: missing expression
    int x = ;
    printf("x is %d\n", x);
    return 0;
}
