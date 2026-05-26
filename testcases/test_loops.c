/*
 * testcases/test_loops.c
 * Loop-heavy test case to evaluate loop nesting depth and loop severity logic.
 */
#include <stdio.h>

// Light loop: 1 loop, nesting = 1
int sum_up_to(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}

// Heavy loop: nested loops, nesting = 3
int process_3d_grid(int size) {
    int sum = 0;
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            for (int k = 0; k < size; k++) {
                sum += i * j * k;
            }
        }
    }
    return sum;
}

int main() {
    int s1 = sum_up_to(100);
    int s2 = process_3d_grid(10);
    printf("Light loop sum: %d\n", s1);
    printf("Heavy loop sum: %d\n", s2);
    return 0;
}
