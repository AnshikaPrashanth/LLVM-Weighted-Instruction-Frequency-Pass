cmake_minimum_required(VERSION 3.13)
project(WeightedInstFreq LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

#----------------------------------------------------------------------
# Find LLVM 14
# Pass: -DLLVM_DIR=/usr/lib/llvm-14/lib/cmake/llvm
#----------------------------------------------------------------------
find_package(LLVM REQUIRED CONFIG)

message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

if(NOT LLVM_PACKAGE_VERSION VERSION_GREATER_EQUAL "14.0" OR
   NOT LLVM_PACKAGE_VERSION VERSION_LESS "15.0")
    message(WARNING "Expected LLVM 14.x, got ${LLVM_PACKAGE_VERSION}")
endif()

include_directories(${LLVM_INCLUDE_DIRS})
add_definitions(${LLVM_DEFINITIONS})

#----------------------------------------------------------------------
# Build the pass as a shared library (plugin for opt)
#
# IMPORTANT: Do NOT link LLVM shared libs into the pass .so.
# When opt-14 loads this plugin via dlopen, LLVM is already in the
# process. Linking our .so against LLVM libs causes cl::opt symbols
# to be registered twice, crashing opt with:
#   "Option 'X' registered more than once!"
#
# Instead, leave LLVM symbols as undefined — the dynamic linker
# resolves them from the already-loaded libLLVM in opt's process.
#----------------------------------------------------------------------
add_library(WeightedInstFreq MODULE
    src/WeightedInstFreq.cpp
)

# No LLVM lib linkage — intentional
# target_link_libraries(WeightedInstFreq ${LLVM_LIBS})  # <-- DO NOT DO THIS

# Compiler flags
if(NOT LLVM_ENABLE_RTTI)
    target_compile_options(WeightedInstFreq PRIVATE -fno-rtti)
endif()

target_compile_options(WeightedInstFreq PRIVATE
    -Wall
    -Wno-unused-function
    -Wno-comment
)

set_target_properties(WeightedInstFreq PROPERTIES
    PREFIX "lib"
    SUFFIX ".so"
)

message(STATUS "Build target: libWeightedInstFreq.so")
message(STATUS "Run with: opt-14 -enable-new-pm=0 -load ./libWeightedInstFreq.so -weighted-inst-freq ...")
