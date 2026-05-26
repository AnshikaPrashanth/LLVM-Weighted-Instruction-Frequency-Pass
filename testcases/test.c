/*
 * test.c — Sample program for WeightedInstFreq LLVM Pass
 *
 * Contains:
 *   - Arithmetic (add, mul, div)
 *   - Memory operations (array access, alloca, load, store)
 *   - Control flow (loops, if/else, return)
 *   - Function calls
 *   - Comparisons
 *   - Cast operations
 *
 * Compile to LLVM IR:
 *   clang-14 -O0 -S -emit-llvm test.c -o test.ll
 *
 * Note: Use -O0 to disable optimizations so all instructions are visible.
 */

#include <stdio.h>

/* -----------------------------------------------------------
 * sum_array: iterates over an int array and accumulates sum.
 * Exercises: memory (load, getelementptr), arithmetic (add),
 *            control flow (br), comparison (icmp).
 * -----------------------------------------------------------*/
int sum_array(int *arr, int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];   /* load + add */
    }
    return sum;
}

/* -----------------------------------------------------------
 * factorial: recursive function.
 * Exercises: call (recursive), comparison, control flow,
 *            arithmetic (mul), memory (alloca, store, load).
 * -----------------------------------------------------------*/
long factorial(int n) {
    if (n <= 1) return 1;
    return (long)n * factorial(n - 1);   /* cast + mul + call */
}

/* -----------------------------------------------------------
 * compute: mixed computation on a 2D-style flat array.
 * Exercises: getelementptr, memory, arithmetic, comparison.
 * -----------------------------------------------------------*/
double compute(double *data, int rows, int cols) {
    double total = 0.0;
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            int idx = i * cols + j;    /* arithmetic */
            total += data[idx];        /* fp add, memory */
            if (data[idx] > 1000.0) {  /* fcmp */
                total -= 10.0;         /* fp sub */
            }
        }
    }
    return total;
}

/* -----------------------------------------------------------
 * classify_value: demonstrates branching (switch-like if/else)
 * and cast operations.
 * Exercises: icmp, br, cast (sext/trunc), arithmetic.
 * -----------------------------------------------------------*/
int classify_value(int x) {
    int result;
    if (x < 0) {
        result = -1;
    } else if (x == 0) {
        result = 0;
    } else if (x < 100) {
        result = 1;
    } else {
        result = 2;
    }
    /* Intentional cast: widen to long, narrow back to int */
    long wide = (long)result;   /* sext */
    return (int)wide;           /* trunc */
}

/* -----------------------------------------------------------
 * bubble_sort: sorting with nested loops.
 * Exercises: memory (load/store), comparison, arithmetic,
 *            control flow (branches).
 * -----------------------------------------------------------*/
void bubble_sort(int *arr, int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                /* swap */
                int tmp   = arr[j];
                arr[j]    = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }
}

/* -----------------------------------------------------------
 * main: ties everything together with printf calls.
 * Exercises: call (printf, sum_array, factorial, compute,
 *            classify_value, bubble_sort).
 * -----------------------------------------------------------*/
int main(void) {
    /* Test sum_array */
    int data[] = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100};
    int n = 10;
    int s = sum_array(data, n);
    printf("sum_array result: %d\n", s);

    /* Test factorial */
    for (int i = 1; i <= 10; i++) {
        printf("factorial(%d) = %ld\n", i, factorial(i));
    }

    /* Test compute */
    double matrix[6] = {100.0, 500.0, 1500.0, 200.0, 800.0, 2000.0};
    double result = compute(matrix, 2, 3);
    printf("compute result: %.2f\n", result);

    /* Test classify_value */
    int vals[] = {-5, 0, 42, 150};
    for (int i = 0; i < 4; i++) {
        printf("classify(%d) = %d\n", vals[i], classify_value(vals[i]));
    }

    /* Test bubble_sort */
    int arr[] = {64, 34, 25, 12, 22, 11, 90};
    int sz = 7;
    bubble_sort(arr, sz);
    printf("Sorted: ");
    for (int i = 0; i < sz; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");

    return 0;
}