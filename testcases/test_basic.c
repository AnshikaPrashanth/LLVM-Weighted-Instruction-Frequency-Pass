/*
 * testcases/test_basic.c
 * Simple test case exercising basic arithmetic and branching.
 */
#include <stdio.h>

int add_simple(int a, int b) {
    int c = a + b;
    int d = a - b;
    return c * d;
}

int check_sign(int x) {
    if (x > 0) {
        return 1;
    } else if (x < 0) {
        return -1;
    }
    return 0;
}

int main() {
    int val1 = add_simple(10, 5);
    int sign1 = check_sign(val1);
    printf("val1: %d, sign1: %d\n", val1, sign1);
    return 0;
}
