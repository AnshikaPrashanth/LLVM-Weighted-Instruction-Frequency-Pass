/*
 * testcases/test_recursion.c
 * Recursion-heavy test case to evaluate function call weights.
 */
#include <stdio.h>

// Fibonacci sequence - recursive
int fibonacci(int n) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Collatz conjecture helper - recursive
int collatz_steps(int n, int steps) {
    if (n == 1) return steps;
    if (n % 2 == 0) {
        return collatz_steps(n / 2, steps + 1);
    } else {
        return collatz_steps(3 * n + 1, steps + 1);
    }
}

int main() {
    int f = fibonacci(10);
    int c = collatz_steps(27, 0);
    printf("fib(10) = %d\n", f);
    printf("collatz steps for 27 = %d\n", c);
    return 0;
}
